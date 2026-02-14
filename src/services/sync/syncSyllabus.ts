/**
 * Sync syllabus for all subjects from IS Mendelu to storage.
 */

import { IndexedDBService } from '../storage';
import { fetchSyllabus, findSubjectId } from '../../api/syllabus';
import type { SyllabusRequirements } from '../../types/documents';

export async function syncSyllabus(): Promise<void> {
    console.log('[syncSyllabus] Starting dual-language syllabus sync...');

    // 1. Get subjects
    const subjectsData = await IndexedDBService.get('subjects', 'current');
    if (!subjectsData || !subjectsData.data) {
        console.log('[syncSyllabus] No subjects data available, skipping syllabus sync');
        return;
    }

    const subjects = Object.entries(subjectsData.data);
    console.log(`[syncSyllabus] Syncing syllabus for ${subjects.length} subjects (dual fetch)`);

    let successCount = 0;
    let errorCount = 0;

    for (const [courseCode, subject] of subjects) {
        try {
            const predmetId = subject.subjectId;
            
            if (!predmetId) {
                console.debug(`[syncSyllabus] No subjectId for ${courseCode}, skipping`);
                continue;
            }
            
            // Fetch both languages in parallel
            const [czSyllabus, enSyllabus] = await Promise.all([
                fetchSyllabus(predmetId, 'cz'),
                fetchSyllabus(predmetId, 'en')
            ]);

            await IndexedDBService.set('syllabuses', courseCode, {
                cz: czSyllabus,
                en: enSyllabus
            });
            
            successCount++;

        } catch (error) {
            console.error(`[syncSyllabus] Failed to sync syllabus for ${courseCode}:`, error);
            errorCount++;
        }
    }

    console.log(`[syncSyllabus] Completed: ${successCount} subjects synced, ${errorCount} errors`);
}

/**
 * Fetch and cache a single subject's syllabus (dual-language) to IDB.
 * Returns the syllabus for the requested language, or undefined on failure.
 */
export async function fetchAndCacheSingleSyllabus(
    courseCode: string,
    language: 'cz' | 'en',
    courseId?: string,
    subjectName?: string
): Promise<SyllabusRequirements | undefined> {
    let activeId = courseId;
    if (!activeId) {
        activeId = await findSubjectId(courseCode, subjectName) || undefined;
    }

    if (!activeId) {
        console.warn(`[syncSyllabus] No subject ID found for ${courseCode}`);
        return undefined;
    }

    const [czSyllabus, enSyllabus] = await Promise.all([
        fetchSyllabus(activeId, 'cz'),
        fetchSyllabus(activeId, 'en')
    ]);

    await IndexedDBService.set('syllabuses', courseCode, {
        cz: czSyllabus,
        en: enSyllabus
    });

    return language === 'en' ? enSyllabus : czSyllabus;
}
