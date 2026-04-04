/**
 * Sync subject data from IS Mendelu to storage.
 */

import { IndexedDBService } from '../storage';
import { fetchDualLanguageSubjects } from '../../api/subjects';
import { useAppStore } from '../../store/useAppStore';

export async function syncSubjects(studium?: string): Promise<void> {
    const result = await fetchDualLanguageSubjects(studium);

    if (result && Object.keys(result.subjects.data).length > 0) {
        await IndexedDBService.set('subjects', 'current', result.subjects);
        useAppStore.getState().setAttendance(result.attendance);
    }
}
