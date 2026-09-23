/**
 * Sync exam data from IS Mendelu to IndexedDB.
 */

import { IndexedDBService } from '../storage';
import { fetchDualLanguageExams } from '../../api/exams';

export async function syncExams(): Promise<void> {
  const data = await fetchDualLanguageExams();

  if (data && data.length > 0) {
    await IndexedDBService.set('exams', 'current', data);
  }
}
