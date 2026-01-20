/**
 * Sync syllabus for all subjects from IS Mendelu to storage.
 */

import { StorageService, STORAGE_KEYS } from '../storage';
import { fetchSyllabus } from '../../api/syllabus';
import type { SubjectsData } from '../../types/documents';

export async function syncSyllabus(): Promise<void> {
    console.log('[syncSyllabus] Starting syllabus sync...');

    // 1. Get subjects
    const subjectsData = StorageService.get<SubjectsData>(STORAGE_KEYS.SUBJECTS_DATA);
    if (!subjectsData || !subjectsData.data) {
        console.log('[syncSyllabus] No subjects data available, skipping syllabus sync');
        return;
    }

    const subjects = Object.entries(subjectsData.data);
    console.log(`[syncSyllabus] Syncing syllabus for ${subjects.length} subjects`);

    let successCount = 0;
    let errorCount = 0;

    for (const [courseCode, subject] of subjects) {
        try {
            // Need to find the numeric course ID (predmet ID)
            const predmetId = subject.subjectId;
            
            if (!predmetId) {
                console.debug(`[syncSyllabus] No subjectId for ${courseCode}, skipping`);
                continue;
            }
            
            const syllabus = await fetchSyllabus(predmetId);

            const storageKey = `${STORAGE_KEYS.SUBJECT_SYLLABUS_PREFIX}${courseCode}`;
            StorageService.set(storageKey, syllabus);
            await StorageService.setAsync(storageKey, syllabus);
            
            successCount++;

        } catch (error) {
            console.error(`[syncSyllabus] Failed to sync syllabus for ${courseCode}:`, error);
            errorCount++;
        }
    }

    console.log(`[syncSyllabus] Completed: ${successCount} subjects synced, ${errorCount} errors`);
}
