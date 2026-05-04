/**
 * API Utilities - Storage accessors for cached data.
 *
 * These functions READ from storage only. Data is populated by SyncService.
 * No on-demand fetching or TTL expiry - just read what's in storage.
 */

import type { FileObject, StoredSubject } from "../types/calendarTypes";
import { IndexedDBService } from "../services/storage";
export async function getStoredSubject(courseCode: string): Promise<StoredSubject | null> {
    const subjectsData = await IndexedDBService.get('subjects', 'current');
    if (!subjectsData || !subjectsData.data) return null;

    const subject = subjectsData.data[courseCode];
    if (!subject) return null;

    return {
        fullName: subject.fullName,
        folderUrl: subject.folderUrl
    };
}

export async function getFilesForSubject(courseCode: string): Promise<FileObject[] | null> {
    const files = await IndexedDBService.get('files', courseCode);
    if (!files) return null;
    // If dual-language, return cz by default; if array, return as-is
    if (Array.isArray(files)) return files as unknown as FileObject[];
    return (files.cz || []) as unknown as FileObject[];
}

/**
 * @deprecated Use getFilesForSubject(courseCode) instead
 */
export async function getFilesFromId(folderId: string | null): Promise<FileObject[] | null> {
    if (!folderId) return null;

    const subjectsData = await IndexedDBService.get('subjects', 'current');
    if (!subjectsData || !subjectsData.data) return null;

    for (const [courseCode, subject] of Object.entries(subjectsData.data)) {
        if (subject.folderUrl.includes(`id=${folderId}`)) {
            return getFilesForSubject(courseCode);
        }
    }

    return null;
}

