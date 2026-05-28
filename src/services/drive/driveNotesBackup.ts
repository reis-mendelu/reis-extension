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
import { loadManifest, saveManifest } from './driveManifest';
import { folderKey, type DriveManifest } from './driveDiff';
import {
    renderSubjectNotesHtml, serializeSubjectNotesJson, notesContentHash, type SubjectNotes,
} from './notesDoc';
import { logError } from '../../utils/reportError';

const DOC_PROP = 'reisNotesDoc';
const JSON_PROP = 'reisNotesJson';
const NOTES_FOLDER = '.notes';

export interface DriveNotesResult {
    written: number;
    skipped: number;
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

export async function syncDriveNotesBackup(subjects: SubjectNotes[]): Promise<DriveNotesResult | null> {
    if (!(await isConnected())) return null;

    const manifest = await loadManifest();
    manifest.notes ??= {};
    if (!manifest.rootFolderId) {
        manifest.rootFolderId = await ensureFolder('reIS');
        await saveManifest(manifest);
    }

    let written = 0;
    let skipped = 0;
    let failed = 0;

    for (const subject of subjects) {
        try {
            if (!hasContent(subject)) { skipped++; continue; }

            const json = serializeSubjectNotesJson(subject);
            const hash = await notesContentHash(json);
            const prev = manifest.notes[subject.code];
            if (prev && prev.docHash === hash) { skipped++; continue; }

            // --- Google Doc (readable) ---
            const subjectFolderId = await ensureChildFolder(manifest, subject.folderName);
            const html = renderSubjectNotesHtml(subject);
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

    return { written, skipped, failed };
}
