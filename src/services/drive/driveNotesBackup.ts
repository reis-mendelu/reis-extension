/**
 * One-way notes backup (Phase 2). Runs in the content-script context after the
 * file backup pass, using the notes snapshot the iframe pushed (the iframe owns
 * the notes IDB; the content script cannot read it directly).
 *
 * Per subject we mirror two artifacts: a readable Google Doc (HTML→Docs) and a
 * lossless JSON sidecar in reIS/.notes/. Idempotent like the file backup —
 * find-or-create by an appProperties stamp, and a content-hash diff skips
 * unchanged subjects so keystroke-level note edits don't churn Drive. No cross-
 * tab lock is taken: the appProperties stamp makes a concurrent run self-heal
 * rather than duplicate (same invariant as the file backup).
 */

import { isConnected } from '../../api/googleAuth';
import {
    ensureFolder, findFileByProperty, uploadDoc, updateDocContent, uploadFile, updateFileContent,
} from '../../api/googleDrive';
import { loadManifest, saveManifest, acquireBackupLock, releaseBackupLock } from './driveManifest';
import { folderKey, type DriveManifest } from './driveDiff';
import {
    renderSubjectNotesHtml, serializeSubjectNotesJson, notesContentHash,
    renderEmptyNotesHtml, serializeEmptyNotesJson, type SubjectNotes,
} from './notesDoc';
import { logError } from '../../utils/reportError';

const DOC_PROP = 'reisNotesDoc';
const JSON_PROP = 'reisNotesJson';
const NOTES_FOLDER = '.notes';

export interface DriveNotesResult {
    written: number;
    skipped: number;
    cleared: number;
    failed: number;
}

/** True if the subject has at least one note with non-whitespace content. */
function hasContent(subject: SubjectNotes): boolean {
    return subject.files.some((f) => f.note.trim().length > 0);
}

async function ensureChildFolder(manifest: DriveManifest, name: string): Promise<string> {
    const key = folderKey([name]);
    let id = manifest.folders[key];
    if (!id) {
        id = await ensureFolder(name, manifest.rootFolderId!);
        manifest.folders[key] = id;
        await saveManifest(manifest);
    }
    return id;
}

/**
 * A subject's notes are all gone — mirror that by emptying its Doc + sidecar in
 * place (keep the file handles, so re-adding a note reuses them). Idempotent:
 * skips when the manifest already records the empty hash. Returns true if it
 * actually wrote.
 */
async function reconcileEmpty(
    manifest: DriveManifest,
    code: string,
    entry: { docId: string; docHash: string; jsonId: string },
): Promise<boolean> {
    const emptyJson = serializeEmptyNotesJson(code);
    const emptyHash = await notesContentHash(emptyJson);
    if (entry.docHash === emptyHash) return false;
    await updateDocContent(entry.docId, renderEmptyNotesHtml());
    await updateFileContent(entry.jsonId, new Blob([emptyJson], { type: 'application/json' }));
    manifest.notes[code] = { docId: entry.docId, docHash: emptyHash, jsonId: entry.jsonId };
    await saveManifest(manifest);
    return true;
}

export async function syncDriveNotesBackup(
    subjects: SubjectNotes[],
    htmlOverrides: Record<string, string> = {},
): Promise<DriveNotesResult | null> {
    if (!(await isConnected())) return null;
    // Share the file backup's mutex: prevents a keystroke-triggered notes pass
    // from racing the periodic one (and clobbering the manifest).
    if (!(await acquireBackupLock())) return null;
    try {
        return await runNotesPass(subjects, htmlOverrides);
    } finally {
        await releaseBackupLock();
    }
}

async function runNotesPass(subjects: SubjectNotes[], htmlOverrides: Record<string, string>): Promise<DriveNotesResult> {
    const manifest = await loadManifest();
    manifest.notes ??= {};
    if (!manifest.rootFolderId) {
        manifest.rootFolderId = await ensureFolder('reIS');
        await saveManifest(manifest);
    }

    let written = 0;
    let skipped = 0;
    let cleared = 0;
    let failed = 0;

    const incoming = new Set(subjects.map((s) => s.code));

    for (const subject of subjects) {
        try {
            if (!hasContent(subject)) {
                const entry = manifest.notes[subject.code];
                if (entry && (await reconcileEmpty(manifest, subject.code, entry))) cleared++;
                else skipped++;
                continue;
            }

            const json = serializeSubjectNotesJson(subject);
            const hash = await notesContentHash(json);
            const prev = manifest.notes[subject.code];
            if (prev && prev.docHash === hash) { skipped++; continue; }

            // --- Google Doc (readable) ---
            const subjectFolderId = await ensureChildFolder(manifest, subject.folderName);
            // Prefer the iframe-rendered base64-inlined HTML (carries card images);
            // fall back to the text-only render when no override was pushed.
            const html = htmlOverrides[subject.code] ?? renderSubjectNotesHtml(subject);
            let docId = prev?.docId ?? (await findFileByProperty(DOC_PROP, subject.code));
            if (docId) {
                await updateDocContent(docId, html);
            } else {
                docId = (await uploadDoc(subject.title, html, [subjectFolderId], { [DOC_PROP]: subject.code })).id;
            }

            // --- JSON sidecar (lossless restore source) ---
            const notesFolderId = await ensureChildFolder(manifest, NOTES_FOLDER);
            const jsonBlob = new Blob([json], { type: 'application/json' });
            let jsonId = prev?.jsonId ?? (await findFileByProperty(JSON_PROP, subject.code));
            if (jsonId) {
                await updateFileContent(jsonId, jsonBlob);
            } else {
                jsonId = (await uploadFile(`${subject.code}.json`, jsonBlob, [notesFolderId], { [JSON_PROP]: subject.code })).id;
            }

            manifest.notes[subject.code] = { docId, docHash: hash, jsonId };
            await saveManifest(manifest);
            written++;
        } catch (e) {
            failed++;
            logError('Drive.notesBackup', e, { code: subject.code });
        }
    }

    // Orphans: recorded in the manifest but no longer in the snapshot at all.
    for (const code of Object.keys(manifest.notes)) {
        if (incoming.has(code)) continue;
        try {
            if (await reconcileEmpty(manifest, code, manifest.notes[code])) cleared++;
        } catch (e) {
            failed++;
            logError('Drive.notesReconcile', e, { code });
        }
    }

    return { written, skipped, cleared, failed };
}
