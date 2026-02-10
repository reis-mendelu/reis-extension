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
    console.log('[syncFiles] Starting dual-language files sync...');

    const subjectsData = await IndexedDBService.get('subjects', 'current');

    if (!subjectsData || !subjectsData.data) {
        console.log('[syncFiles] No subjects data available, skipping file sync');
        return;
    }

    const subjects = Object.entries(subjectsData.data);
    console.log(`[syncFiles] Syncing files for ${subjects.length} subjects (dual fetch)`);

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
            
            // Fetch both languages in parallel
            const [czFiles, enFiles] = await Promise.all([
                fetchFilesFromFolder(folderUrl, 'cs'),
                fetchFilesFromFolder(folderUrl, 'en')
            ]);

            // Store in a dual-language structure
            await IndexedDBService.set('files', courseCode, { 
                cz: Array.isArray(czFiles) ? czFiles : [], 
                en: Array.isArray(enFiles) ? enFiles : [] 
            });
            
            successCount++;
        } catch (error) {
            console.error(`[syncFiles] Failed to sync files for ${courseCode}:`, error);
            errorCount++;
        }
    }

    console.log(`[syncFiles] Completed: ${successCount} subjects synced, ${errorCount} errors`);
}
