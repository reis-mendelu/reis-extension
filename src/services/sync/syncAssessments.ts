
/**
 * Sync assessments for all subjects from IS Mendelu to storage.
 */

import { IndexedDBService } from '../storage';
import { fetchAssessments } from '../../api/assessments';
import { getUserParams } from '../../utils/userParams';

export async function syncAssessments(studiumIn?: string): Promise<void> {
    console.log('[syncAssessments] Starting dual-language assessments sync...');

    // 1. Get required user parameters
    let studium = studiumIn || '';
    let obdobi = '';

    const userParams = await getUserParams();
    if (userParams && userParams.studium && userParams.obdobi) {
        studium = userParams.studium;
        obdobi = userParams.obdobi;
    } else {
        console.warn('[syncAssessments] UserParams incomplete, attempting fallback to schedule data');
        // Fallback to schedule (which is known to be robust)
        const schedule = await IndexedDBService.get('schedule', 'current');
        if (schedule && schedule.length > 0 && schedule[0].studyId && schedule[0].periodId) {
             studium = schedule[0].studyId;
             obdobi = schedule[0].periodId;
             console.log(`[syncAssessments] Fallback successful: studium=${studium}, obdobi=${obdobi}`);
        }
    }

    if (!studium || !obdobi) {
        console.error('[syncAssessments] failed to resolve studium/obdobi parameters from both UserParams and Schedule. Aborting.');
        return;
    }

    // 2. Get subjects
    const subjectsData = await IndexedDBService.get('subjects', 'current');
    if (!subjectsData || !subjectsData.data) {
        console.log('[syncAssessments] No subjects data available, skipping assessment sync');
        return;
    }

    const subjects = Object.entries(subjectsData.data);
    console.log(`[syncAssessments] Syncing assessments for ${subjects.length} subjects (studium=${studium}, obdobi=${obdobi})`);

    let successCount = 0;
    let errorCount = 0;

    for (const [courseCode, subject] of subjects) {
        try {
            // Need to find the numeric course ID (predmet ID)
            // It's usually in the folder URL: .../slozka.pl?id=51654
            // OR in the syllabus URL: .../syllabus.pl?predmet=12345
            
            // Use the subjectId extracted from syllabus link (predmet=...)
            // If missing, we can try to fallback to folder ID, but it's likely wrong for assessments.
            const predmetId = subject.subjectId;
            
            if (!predmetId) {
                console.debug(`[syncAssessments] No subjectId for ${courseCode}, skipping`);
                continue;
            }
            
            // Fetch both languages in parallel
            const [czAssessments, enAssessments] = await Promise.all([
                fetchAssessments(studium, obdobi, predmetId, 'cs'),
                fetchAssessments(studium, obdobi, predmetId, 'en')
            ]);
            
            await IndexedDBService.set('assessments', courseCode, {
                cz: czAssessments,
                en: enAssessments
            });
            
            if (czAssessments.length > 0 || enAssessments.length > 0) {
                console.debug(`[syncAssessments] Found ${czAssessments.length} CZ and ${enAssessments.length} EN assessments for ${courseCode}`);
            }
            successCount++;

        } catch (error) {
            console.error(`[syncAssessments] Failed to sync assessments for ${courseCode}:`, error);
            errorCount++;
        }
    }

    console.log(`[syncAssessments] Completed: ${successCount} subjects synced, ${errorCount} errors`);
}
