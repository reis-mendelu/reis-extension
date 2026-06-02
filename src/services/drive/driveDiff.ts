/**
 * Pure logic for the one-way Drive backup: normalise IS files into upload items
 * and diff them against the local manifest. No I/O — easy to test, easy to reason
 * about. The orchestrator (driveBackup.ts) performs the actual folder/file calls.
 */

import type { ParsedFile } from '../../types/documents';

/** A single downloadable IS file, normalised for Drive. */
export interface DriveSyncItem {
    /** IS download URL — stable per file, used as the manifest dedup key. */
    isLink: string;
    /** Display name for the Drive file. */
    fileName: string;
    /** IS document date string — the change signal (any change ⇒ re-upload). */
    date: string;
    /** Folder path under the Drive root, e.g. ['BIK-DBS - Databases', 'Lectures']. */
    pathSegments: string[];
}

export interface DriveManifest {
    /** Drive id of the top-level 'reIS' folder, or null until created. */
    rootFolderId: string | null;
    /** webViewLink of the 'reIS' root folder — lets the UI offer "open in Drive". */
    rootWebViewLink: string | null;
    /** folderKey(pathSegments) → Drive folder id. */
    folders: Record<string, string>;
    /** isLink → mirrored file state. */
    files: Record<string, { driveFileId: string; date: string }>;
    /** courseCode → backed-up notes Doc + sidecar state. */
    notes: Record<string, { docId: string; docHash: string; jsonId: string; imagesEmbedded?: boolean }>;
    /** Epoch ms of the last completed backup pass. */
    lastSync: number;
    /** Epoch ms of the first failure in the current failing streak; null when the last pass succeeded. */
    failingSince: number | null;
    /** Message of the most recent pass-level failure, for diagnostics; null when healthy. */
    lastError: string | null;
    /** True while a backup pass is actively running — lets the UI show a spinner. */
    syncing: boolean;
}

export interface DriveDiff {
    create: DriveSyncItem[];
    update: { item: DriveSyncItem; driveFileId: string }[];
    skip: number;
}

export function emptyManifest(): DriveManifest {
    return { rootFolderId: null, rootWebViewLink: null, folders: {}, files: {}, notes: {}, lastSync: 0, failingSince: null, lastError: null, syncing: false };
}

/** Manifest key for a folder path. */
export function folderKey(segments: string[]): string {
    return segments.join('/');
}

/**
 * Stable 96-bit hash of an IS link, stored on the Drive file as an
 * `appProperties` value. Lets us recognise an already-uploaded file even when
 * the local manifest entry was lost (interrupted run) — the dedup key that
 * makes uploads idempotent. Filenames can't serve this role: IS legitimately
 * has many distinct files sharing one display name (e.g. six "Materiály").
 */
export async function linkHash(isLink: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(isLink));
    return [...new Uint8Array(digest)]
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/** Max Drive file name we emit — comfortably under the 255-char limit Drive's
 *  desktop/mobile sync clients impose on a single path segment. */
const DRIVE_NAME_MAX = 200;

/** Strip chars that break Drive desktop sync (Windows/macOS reserved) plus
 *  control chars / newlines a free-text teacher comment may carry, then collapse
 *  runs of whitespace. */
function sanitizeForName(s: string): string {
    // eslint-disable-next-line no-control-regex
    return s.replace(/[\x00-\x1f<>:"/\\|?*]+/g, " ").replace(/\s+/g, ' ').trim();
}

/**
 * Build the Drive file name for an IS attachment. IS exposes a document name AND
 * a teacher "comment", and some teachers put the real title in the comment while
 * leaving the name generic ("dokument"). The reIS file list already shows the
 * comment beside the name and sorts by it, so we mirror that here: fold the
 * comment into the name losslessly ("<name> — <comment>") instead of dropping it,
 * so a student browsing the mirror in the Drive app on their phone sees the same
 * meaningful label they see in reIS. Falls back to whichever half is present.
 */
export function buildDriveFileName(fileName: string, comment?: string): string {
    const name = sanitizeForName(fileName || '');
    const note = sanitizeForName(comment || '');
    let out: string;
    if (!note || note.toLowerCase() === name.toLowerCase()) out = name || note;
    else if (!name) out = note;
    else out = `${name} — ${note}`;
    out = out.trim() || 'soubor';
    return out.length > DRIVE_NAME_MAX ? out.slice(0, DRIVE_NAME_MAX).trim() : out;
}

/** Flatten a subject's parsed files into one item per downloadable attachment. */
export function flattenSubjectFiles(subjectFolderName: string, parsedFiles: ParsedFile[]): DriveSyncItem[] {
    const items: DriveSyncItem[] = [];
    for (const group of parsedFiles) {
        const sub = group.subfolder?.trim();
        const pathSegments = sub ? [subjectFolderName, sub] : [subjectFolderName];
        for (const att of group.files) {
            if (!att.link) continue;
            items.push({
                isLink: att.link,
                fileName: buildDriveFileName(att.name || group.file_name, group.file_comment),
                date: group.date || '',
                pathSegments,
            });
        }
    }
    return items;
}

/** Split items into create / update / skip relative to what the manifest already mirrors. */
export function diffManifest(items: DriveSyncItem[], manifest: DriveManifest): DriveDiff {
    const create: DriveSyncItem[] = [];
    const update: { item: DriveSyncItem; driveFileId: string }[] = [];
    let skip = 0;

    for (const item of items) {
        const existing = manifest.files[item.isLink];
        if (!existing) {
            create.push(item);
        } else if (existing.date !== item.date) {
            update.push({ item, driveFileId: existing.driveFileId });
        } else {
            skip++;
        }
    }

    return { create, update, skip };
}
