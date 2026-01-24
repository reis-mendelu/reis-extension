/**
 * API Utilities - Storage accessors for cached data.
 * 
 * These functions READ from storage only. Data is populated by SyncService.
 * No on-demand fetching or TTL expiry - just read what's in storage.
 */

import type { FileObject, StoredSubject } from "../types/calendarTypes";
import { IndexedDBService } from "../services/storage";
import type { SubjectsData, Assessment } from "../types/documents";

/**
 * Get a stored subject by course code.
 * Reads directly from storage (populated by syncSubjects).
 */
export async function getStoredSubject(courseCode: string): Promise<StoredSubject | null> {
    const subjectsData = await IndexedDBService.get('subjects', 'current');

    if (!subjectsData || !subjectsData.data) {
        console.debug('[getStoredSubject] No subjects data in storage');
        return null;
    }

    const subject = subjectsData.data[courseCode];

    if (!subject) {
        console.debug(`[getStoredSubject] Subject ${courseCode} not found`);
        return null;
    }

    return {
        fullName: subject.fullName,
        folderUrl: subject.folderUrl
    };
}

/**
 * Get files for a subject by course code.
 * Reads directly from storage (populated by syncFiles).
 */
export async function getFilesForSubject(courseCode: string): Promise<FileObject[] | null> {
    const files = await IndexedDBService.get('files', courseCode);

    if (!files) {
        console.debug(`[getFilesForSubject] No files in storage for ${courseCode}`);
        return null;
    }

    console.debug(`[getFilesForSubject] Returning ${files.length} files for ${courseCode}`);
    return files;
}

/**
 * Legacy function - kept for compatibility but now just calls getFilesForSubject.
 * @deprecated Use getFilesForSubject(courseCode) instead
 */
export async function getFilesFromId(folderId: string | null): Promise<FileObject[] | null> {
    if (!folderId) return null;

    // Try to find the course code by folder ID
    const subjectsData = await IndexedDBService.get('subjects', 'current');

    if (!subjectsData || !subjectsData.data) {
        console.debug('[getFilesFromId] No subjects data in storage');
        return null;
    }

    // Find course code by matching folder ID in URL
    for (const [courseCode, subject] of Object.entries(subjectsData.data)) {
        if (subject.folderUrl.includes(`id=${folderId}`)) {
            return getFilesForSubject(courseCode);
        }
    }

    console.debug(`[getFilesFromId] No subject found with folder ID ${folderId}`);
    return null;
}

/**
 * Get assessments for a subject by course code.
 * Reads directly from storage (populated by syncAssessments).
 */
export async function getAssessmentsForSubject(courseCode: string): Promise<Assessment[] | null> {
    const assessments = await IndexedDBService.get('assessments', courseCode);

    if (!assessments) {
        console.debug(`[getAssessmentsForSubject] No assessments in storage for ${courseCode}`);
        return null;
    }

    return assessments;
}
