/**
 * Sync files for all subjects from IS Mendelu to storage.
 */

import { IndexedDBService } from '../storage';
import { fetchFilesFromFolder } from '../../api/documents';

function getIdFromUrl(url: string): string | null {
    const match = url.match(/[?&;]id=(\d+)/);
    return match ? match[1] : null;
}

export async function syncFiles(): Promise<void> {
    console.log('[syncFiles] Starting files sync...');

    const subjectsData = await IndexedDBService.get('subjects', 'current');

    if (!subjectsData || !subjectsData.data) {
        console.log('[syncFiles] No subjects data available, skipping file sync');
        return;
    }

    const subjects = Object.entries(subjectsData.data);
    console.log(`[syncFiles] Syncing files for ${subjects.length} subjects`);

    let successCount = 0;
    let errorCount = 0;

    for (const [courseCode, subject] of subjects) {
        try {
            const folderId = getIdFromUrl(subject.folderUrl);
            if (!folderId) {
                console.warn(`[syncFiles] Could not extract folder ID for ${courseCode}`);
                continue;
            }

            const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;
            const files = await fetchFilesFromFolder(folderUrl);

            if (files) {
                // files can be [] if folder is empty, or [...] if has files. 
                // We want to store it even if empty, so UI knows it's "0 files" vs "loading"
                await IndexedDBService.set('files', courseCode, files);
                successCount++;
            }
        } catch (error) {
            console.error(`[syncFiles] Failed to sync files for ${courseCode}:`, error);
            errorCount++;
        }
    }

    console.log(`[syncFiles] Completed: ${successCount} subjects synced, ${errorCount} errors`);
}
