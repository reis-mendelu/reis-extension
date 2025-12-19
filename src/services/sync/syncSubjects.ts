/**
 * Sync subject data from IS Mendelu to storage.
 */

import { StorageService, STORAGE_KEYS } from '../storage';
import { fetchSubjects } from '../../api/subjects';

export async function syncSubjects(): Promise<void> {
    console.log('[syncSubjects] Fetching subject data...');

    const data = await fetchSubjects();

    if (data && Object.keys(data.data).length > 0) {
        StorageService.set(STORAGE_KEYS.SUBJECTS_DATA, data);
        await StorageService.setAsync(STORAGE_KEYS.SUBJECTS_DATA, data);
        console.log(`[syncSubjects] Stored ${Object.keys(data.data).length} subjects`);
    } else {
        console.log('[syncSubjects] No subject data to store');
    }
}
