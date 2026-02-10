/**
 * Sync exam data from IS Mendelu to IndexedDB.
 */

import { IndexedDBService } from '../storage';
import { fetchDualLanguageExams } from '../../api/exams';

export async function syncExams(): Promise<void> {
    console.log('[syncExams] Fetching dual-language exam data...');

    const data = await fetchDualLanguageExams();

    if (data && data.length > 0) {
        await IndexedDBService.set('exams', 'current', data);
        console.log(`[syncExams] Stored ${data.length} subjects with localized exams`);
    } else {
        console.log('[syncExams] No exam data to store');
    }
}
