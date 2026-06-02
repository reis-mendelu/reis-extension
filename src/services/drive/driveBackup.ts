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

/** Thrown when an IS download 302s to the login page — a pass-wide condition (re-auth needed). */
class IsSessionExpiredError extends Error {}
/**
 * Thrown when an IS row is not a downloadable file — a 200 text/html body at a
 * non-login URL (a web-link, sub-folder, or info page like "00 - Reading Week
 * instrukce"). A per-entry condition: skip just this row, never abort the pass
 * or mark the backup unhealthy.
 */
class NotADownloadableFileError extends Error {}

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
    /** Files deemed permanently un-mirrorable (failed past the retry threshold) — reported, not alarmed. */
    quarantined: number;
}

/** Consecutive failed passes after which a file is treated as permanently
 *  un-mirrorable (a genuinely broken IS download), so it stops holding the whole
 *  backup amber — one bad file must never train the user to ignore the warning. */
const FAIL_THRESHOLD = 3;

const ROOT_FOLDER_NAME = 'reIS';
const limit = pLimit(3);
const IS_DEV = import.meta.env.VITE_GOOGLE_DEV === 'true';

let running = false;

function log(msg: string) {
    if (IS_DEV) console.info(`[reIS Drive] ${msg}`);
}

async function fetchBytes(link: string): Promise<Blob> {
    const res = await fetchWithAuth(link);
    // fetchWithAuth (401/403-only guard) lets an HTML body through, so we must
    // tell two HTML cases apart — uploading either would corrupt the backup:
    //   1. Expired session: IS 302s the download to login.pl; fetch follows it
    //      to a 200 login page. Pass-wide — re-auth fixes every file at once.
    //   2. Not a file: the row is a web-link, sub-folder, or info page that
    //      serves 200 text/html at a normal IS URL. Per-entry and permanent —
    //      it must NOT look like a session failure or it would abort the pass
    //      and trip a warning the user can never clear by re-authenticating.
    if (/login\.pl/i.test(res.url)) {
        throw new IsSessionExpiredError('expected a file but got the IS login page (expired session)');
    }
    if (/text\/html/i.test(res.headers.get('content-type') || '')) {
        throw new NotADownloadableFileError('IS row is not a downloadable file (served an HTML page)');
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
    // A failure is "transient" (will retry — legitimate amber) until a file has
    // missed FAIL_THRESHOLD passes, at which point it's "permanent" and reported
    // separately instead of keeping the whole backup amber forever.
    let transientFailed = 0;
    let permanentFailed = 0;
    const recordFileFail = (isLink: string) => {
        const n = (manifest.fileFails[isLink] ?? 0) + 1;
        manifest.fileFails[isLink] = n;
        if (n >= FAIL_THRESHOLD) permanentFailed++; else transientFailed++;
    };
    const clearFileFail = (isLink: string) => {
        if (manifest.fileFails[isLink]) delete manifest.fileFails[isLink];
    };
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
                    if (sessionExpired) { transientFailed++; return; }
                    try {
                        const hash = await linkHash(item.isLink);
                        // Manifest says "new", but Drive may already have it (a prior
                        // interrupted run). Reuse it instead of uploading a duplicate.
                        const existingId = await findFileByProperty(LINK_PROP, hash);
                        if (existingId) {
                            manifest.files[item.isLink] = { driveFileId: existingId, date: item.date };
                            clearFileFail(item.isLink);
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
                        clearFileFail(item.isLink);
                        uploaded++;
                    } catch (e) {
                        // A web-link/folder row isn't a file — skip it, don't fail the pass.
                        if (e instanceof NotADownloadableFileError) { skipped++; return; }
                        // Session expiry is pass-wide and re-auth fixes it — not the
                        // file's fault, so it never counts toward quarantine.
                        if (e instanceof IsSessionExpiredError) { sessionExpired = true; transientFailed++; }
                        else recordFileFail(item.isLink);
                        logError('Drive.upload', e, { name: item.fileName });
                    }
                }));
            }
            for (const { item, driveFileId } of diff.update) {
                tasks.push(limit(async () => {
                    if (sessionExpired) { transientFailed++; return; }
                    try {
                        await updateFileContent(driveFileId, await fetchBytes(item.isLink));
                        manifest.files[item.isLink] = { driveFileId, date: item.date };
                        clearFileFail(item.isLink);
                        updated++;
                    } catch (e) {
                        // A web-link/folder row isn't a file — skip it, don't fail the pass.
                        if (e instanceof NotADownloadableFileError) { skipped++; return; }
                        if (e instanceof IsSessionExpiredError) { sessionExpired = true; transientFailed++; }
                        else recordFileFail(item.isLink);
                        logError('Drive.update', e, { name: item.fileName });
                    }
                }));
            }
            await Promise.all(tasks);
            await saveManifest(manifest); // persist progress per subject
            if (sessionExpired) break;
        }

        manifest.lastSync = Date.now();
        manifest.quarantined = Object.values(manifest.fileFails).filter((n) => n >= FAIL_THRESHOLD).length;
        if (transientFailed > 0) {
            // Files that may still recover — keep the streak open so the UI shows a
            // warning instead of a clean "synced just now" that quietly lost files.
            manifest.failingSince = manifest.failingSince ?? Date.now();
            manifest.lastError = `${transientFailed} file(s) failed to upload`;
        } else {
            // Either fully healthy, or the only failures are permanently un-mirrorable
            // files — report those as a calm aside, never as a live failure streak.
            manifest.failingSince = null;
            manifest.lastError = manifest.quarantined > 0 ? `${manifest.quarantined} file(s) can't be saved` : null;
        }
        await saveManifest(manifest);
        const failed = transientFailed + permanentFailed;
        log(`done — uploaded ${uploaded}, updated ${updated}, reused ${reused}, skipped ${skipped}, failed ${failed}, quarantined ${manifest.quarantined}`);
        return { uploaded, updated, skipped, reused, failed, quarantined: manifest.quarantined };
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
