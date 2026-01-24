/**
 * Sync exam data from IS Mendelu to IndexedDB.
 */

import { IndexedDBService } from '../storage';
import { fetchExamData } from '../../api/exams';

export async function syncExams(): Promise<void> {
    console.log('[syncExams] Fetching exam data...');

    const data = await fetchExamData();

    if (data && data.length > 0) {
        await IndexedDBService.set('exams', 'current', data);
        console.log(`[syncExams] Stored ${data.length} subjects with exams`);
    } else {
        console.log('[syncExams] No exam data to store');
    }
}
