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
    notes: Record<string, { docId: string; docHash: string; jsonId: string }>;
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
                fileName: att.name || group.file_name,
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
