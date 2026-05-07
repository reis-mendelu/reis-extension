/**
 * Sync files for all subjects from IS Mendelu to storage.
 */

import { IndexedDBService } from '../storage';
import { fetchFilesFromFolder } from '../../api/documents';
import { logError } from '../../utils/reportError';

function getIdFromUrl(url: string): string | null {
    const match = url.match(/[?&;]id=(\d+)/);
    return match ? match[1] : null;
}

export async function syncFiles(): Promise<void> {
    const subjectsData = await IndexedDBService.get('subjects', 'current');

    if (!subjectsData || !subjectsData.data) {
        return;
    }

    const subjects = Object.entries(subjectsData.data);

    for (const [courseCode, subject] of subjects) {
        try {
            const folderId = getIdFromUrl(subject.folderUrl);
            if (!folderId) {
                continue;
            }

            const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;

            // Fetch both languages in parallel
            const [czFiles, enFiles] = await Promise.all([
                fetchFilesFromFolder(folderUrl, 'cz'),
                fetchFilesFromFolder(folderUrl, 'en')
            ]);

            // Store in a dual-language structure
            await IndexedDBService.set('files', courseCode, {
                cz: Array.isArray(czFiles) ? czFiles : [],
                en: Array.isArray(enFiles) ? enFiles : []
            });
        } catch (e) {
            logError('Sync.syncFiles', e, { courseCode });
        }
    }

}
