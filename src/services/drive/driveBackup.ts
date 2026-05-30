/**
 * One-way Drive backup (Phase 1). Runs in the content-script context — the only
 * place with IS session cookies (for binary file fetches), the Google token
 * (chrome.storage.local), and the googleapis host permission.
 *
 * It does NOT re-crawl IS: the regular sync already populates per-subject file
 * listings, which are passed in here. We just diff against the manifest and push
 * new/changed files, mirroring the IS folder structure one level deep
 * (reIS/<subject>/<subfolder>/<file>).
 */

import pLimit from 'p-limit';
import type { ParsedFile } from '../../types/documents';
import { fetchWithAuth } from '../../api/client';
import { isConnected } from '../../api/googleAuth';
import { uploadFile, updateFileContent, ensureFolder, findFileByProperty, deleteFile, getFileLink } from '../../api/googleDrive';
import { loadManifest, saveManifest, clearManifest, acquireBackupLock, releaseBackupLock } from './driveManifest';
import { flattenSubjectFiles, diffManifest, folderKey, linkHash, type DriveManifest } from './driveDiff';
import { logError } from '../../utils/reportError';

/** Thrown when an IS download returns a login/HTML page — a pass-wide condition. */
class IsSessionExpiredError extends Error {}

const LINK_PROP = 'reisLink';

export interface DriveBackupSubject {
    code: string;
    folderName: string;
    files: ParsedFile[];
}

export interface DriveBackupResult {
    uploaded: number;
    updated: number;
    skipped: number;
    /** Files already present in Drive (found via appProperties) — manifest healed, not re-uploaded. */
    reused: number;
    /** Files that failed to download/upload this pass — a non-zero count marks the pass unhealthy. */
    failed: number;
}

const ROOT_FOLDER_NAME = 'reIS';
const limit = pLimit(3);
const IS_DEV = import.meta.env.VITE_GOOGLE_DEV === 'true';

let running = false;

function log(msg: string) {
    if (IS_DEV) console.info(`[reIS Drive] ${msg}`);
}

async function fetchBytes(link: string): Promise<Blob> {
    const res = await fetchWithAuth(link);
    // IS download links 302 to login.pl on an expired session; fetch follows
    // the redirect to a 200 HTML page, which fetchWithAuth (401/403-only guard)
    // lets through. Uploading that page would silently corrupt the backup, so
    // reject anything that came back as an HTML document — real attachments
    // (pdf/docx/zip/…) never are.
    if (/login\.pl/i.test(res.url) || /text\/html/i.test(res.headers.get('content-type') || '')) {
        throw new IsSessionExpiredError('expected a file but got an HTML page (likely an expired IS session)');
    }
    return await res.blob();
}

/**
 * Wipe the Drive backup: delete the root 'reIS' folder (cascades to every
 * subject folder and file) and clear the local manifest, so the next sync
 * rebuilds from scratch. Used to recover from a duplicated state.
 */
export async function resetDriveBackup(): Promise<{ deleted: boolean }> {
    const manifest = await loadManifest();
    let deleted = false;
    if (manifest.rootFolderId) {
        await deleteFile(manifest.rootFolderId);
        deleted = true;
    }
    await clearManifest();
    return { deleted };
}

/** Ensure every folder in `segments` exists under the root, caching ids in the manifest. */
async function ensureFolderPath(manifest: DriveManifest, segments: string[]): Promise<string> {
    let parentId = manifest.rootFolderId!;
    const acc: string[] = [];
    for (const seg of segments) {
        acc.push(seg);
        const key = folderKey(acc);
        let id = manifest.folders[key];
        if (!id) {
            // find-or-create (idempotent) + persist immediately, so an interrupted
            // run can't lose the id and recreate a duplicate folder next pass.
            id = await ensureFolder(seg, parentId);
            manifest.folders[key] = id;
            await saveManifest(manifest);
        }
        parentId = id;
    }
    return parentId;
}

/**
 * Back up the given subjects' files to Drive. No-op (returns null) if not linked
 * to Google. Diffs against the manifest and uploads only deltas, so it's cheap to
 * run on every sync — there's no time throttle, the work scales with what changed.
 * Per-file failures are logged and counted, never fatal; a non-zero count marks
 * the pass unhealthy so the UI never claims a clean backup that lost files.
 */
export async function syncDriveBackup(
    subjects: DriveBackupSubject[],
): Promise<DriveBackupResult | null> {
    if (running) { log('skip: already running'); return null; }
    if (!(await isConnected())) { log('skip: not connected to Google'); return null; }

    const manifest = await loadManifest();

    // Cross-tab guard: another IS Mendelu tab may already be backing up.
    if (!(await acquireBackupLock())) { log('skip: another tab holds the backup lock'); return null; }

    log(`start: ${subjects.length} subject(s)`);
    running = true;
    manifest.syncing = true;
    await saveManifest(manifest);
    let uploaded = 0;
    let updated = 0;
    let skipped = 0;
    let reused = 0;
    let failed = 0;
    try {
        if (!manifest.rootFolderId) {
            manifest.rootFolderId = await ensureFolder(ROOT_FOLDER_NAME);
            await saveManifest(manifest);
        }
        // Capture the root's "open in Drive" link once, so the UI can link to it.
        if (!manifest.rootWebViewLink) {
            manifest.rootWebViewLink = await getFileLink(manifest.rootFolderId).catch(() => null);
            if (manifest.rootWebViewLink) await saveManifest(manifest);
        }

        let sessionExpired = false;
        for (const subject of subjects) {
            const items = flattenSubjectFiles(subject.folderName, subject.files);
            const diff = diffManifest(items, manifest);
            skipped += diff.skip;
            log(`${subject.code}: ${items.length} files → +${diff.create.length} new, ~${diff.update.length} changed, =${diff.skip} skip`);
            if (!diff.create.length && !diff.update.length) continue;

            // Pre-create folders sequentially so parallel uploads can't race-create duplicates.
            for (const { pathSegments } of [...diff.create, ...diff.update.map((u) => u.item)]) {
                await ensureFolderPath(manifest, pathSegments);
            }

            const tasks: Promise<void>[] = [];
            for (const item of diff.create) {
                tasks.push(limit(async () => {
                    if (sessionExpired) { failed++; return; }
                    try {
                        const hash = await linkHash(item.isLink);
                        // Manifest says "new", but Drive may already have it (a prior
                        // interrupted run). Reuse it instead of uploading a duplicate.
                        const existingId = await findFileByProperty(LINK_PROP, hash);
                        if (existingId) {
                            manifest.files[item.isLink] = { driveFileId: existingId, date: item.date };
                            reused++;
                            return;
                        }
                        const parentId = manifest.folders[folderKey(item.pathSegments)];
                        const file = await uploadFile(
                            item.fileName,
                            await fetchBytes(item.isLink),
                            parentId ? [parentId] : undefined,
                            { [LINK_PROP]: hash },
                        );
                        manifest.files[item.isLink] = { driveFileId: file.id, date: item.date };
                        uploaded++;
                    } catch (e) {
                        if (e instanceof IsSessionExpiredError) sessionExpired = true;
                        failed++;
                        logError('Drive.upload', e, { name: item.fileName });
                    }
                }));
            }
            for (const { item, driveFileId } of diff.update) {
                tasks.push(limit(async () => {
                    if (sessionExpired) { failed++; return; }
                    try {
                        await updateFileContent(driveFileId, await fetchBytes(item.isLink));
                        manifest.files[item.isLink] = { driveFileId, date: item.date };
                        updated++;
                    } catch (e) {
                        if (e instanceof IsSessionExpiredError) sessionExpired = true;
                        failed++;
                        logError('Drive.update', e, { name: item.fileName });
                    }
                }));
            }
            await Promise.all(tasks);
            await saveManifest(manifest); // persist progress per subject
            if (sessionExpired) break;
        }

        manifest.lastSync = Date.now();
        if (failed > 0) {
            // Some files didn't make it — keep the streak open so the UI shows a
            // warning instead of a clean "backed up just now" that lost files.
            manifest.failingSince = manifest.failingSince ?? Date.now();
            manifest.lastError = `${failed} file(s) failed to upload`;
        } else {
            manifest.failingSince = null;
            manifest.lastError = null;
        }
        await saveManifest(manifest);
        log(`done — uploaded ${uploaded}, updated ${updated}, reused ${reused}, skipped ${skipped}, failed ${failed}`);
        return { uploaded, updated, skipped, reused, failed };
    } catch (e) {
        // Pass-level failure (auth/root/network) — record it so the UI can show
        // "backup failing since …" instead of silently appearing healthy. The
        // streak start is kept until a pass succeeds.
        manifest.lastError = e instanceof Error ? e.message : String(e);
        manifest.failingSince = manifest.failingSince ?? Date.now();
        await saveManifest(manifest).catch(() => {});
        throw e;
    } finally {
        running = false;
        manifest.syncing = false;
        await saveManifest(manifest).catch(() => {});
        await releaseBackupLock();
    }
}
