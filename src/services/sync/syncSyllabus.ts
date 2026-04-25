/**
 * Sync syllabus for all subjects from IS Mendelu to storage.
 */

import { IndexedDBService } from '../storage';
import { fetchSyllabus, findSubjectId } from '../../api/syllabus';
import type { SyllabusRequirements } from '../../types/documents';

export async function syncSyllabus(): Promise<void> {
    const subjectsData = await IndexedDBService.get('subjects', 'current');
    if (!subjectsData || !subjectsData.data) return;

    const subjects = Object.entries(subjectsData.data);

    for (const [courseCode, subject] of subjects) {
        try {
            const predmetId = subject.subjectId;
            if (!predmetId) continue;

            const [czSyllabus, enSyllabus] = await Promise.all([
                fetchSyllabus(predmetId, 'cz'),
                fetchSyllabus(predmetId, 'en')
            ]);

            await IndexedDBService.set('syllabuses', courseCode, {
                cz: czSyllabus,
                en: enSyllabus
            });
        } catch (e) {
            console.error(`[syncSyllabus] Failed for ${courseCode}:`, e);
        }
    }
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
        console.log(`[fetchAndCacheSingleSyllabus] finding subject id for ${courseCode}...`);
        activeId = await findSubjectId(courseCode, subjectName) || undefined;
        console.log(`[fetchAndCacheSingleSyllabus] found activeId: ${activeId}`);
    }

    if (!activeId) {
        return undefined;
    }

    const [czSyllabus, enSyllabus] = await Promise.all([
        fetchSyllabus(activeId, 'cz'),
        fetchSyllabus(activeId, 'en')
    ]);

    console.log(`[fetchAndCacheSingleSyllabus] fetch activeId: ${activeId} complete.`);
    await IndexedDBService.set('syllabuses', courseCode, {
        cz: czSyllabus,
        en: enSyllabus
    });

    return language === 'en' ? enSyllabus : czSyllabus;
}
