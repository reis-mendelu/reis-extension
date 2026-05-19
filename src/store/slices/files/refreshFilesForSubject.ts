import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import type { ParsedFile, SubjectsData } from '../../../types/documents';
import type { Language } from '../../types';

export const FILES_LAST_FETCHED_KEY = 'files_last_fetched';

interface FolderFetchInput {
    courseCode: string;
    language: Language;
    subjects: SubjectsData | null;
}

interface FolderFetchResult {
    displayList: ParsedFile[];
    fetchedAt: number;
}

/**
 * Force-fetch a single subject's files from IS Mendelu, merge into the
 * dual-language IDB cache, and return the list in the active language.
 * Returns null if the subject has no folder URL (nothing to fetch).
 */
export async function fetchAndPersistFolderFiles({
    courseCode,
    language,
    subjects,
}: FolderFetchInput): Promise<FolderFetchResult | null> {
    const subjectsData = subjects
        ?? ((await IndexedDBService.get('subjects', 'current')) as SubjectsData | null);
    const subject = subjectsData?.data?.[courseCode];
    if (!subject?.folderUrl) return null;

    const folderId = subject.folderUrl.match(/[?&;]id=(\d+)/)?.[1];
    if (!folderId) return null;

    const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;
    const { fetchFilesFromFolder } = await import('../../../api/documents/service');
    const fullFilesList = await fetchFilesFromFolder(folderUrl, language, true, 0, 2);

    const cachedFiles = await IndexedDBService.get('files', courseCode);
    const data = (cachedFiles && 'cz' in cachedFiles && 'en' in cachedFiles)
        ? cachedFiles as { cz: ParsedFile[]; en: ParsedFile[] }
        : { cz: [] as ParsedFile[], en: [] as ParsedFile[] };
    if (language === 'en') data.en = fullFilesList; else data.cz = fullFilesList;
    await IndexedDBService.set('files', courseCode, data);

    return { displayList: fullFilesList, fetchedAt: Date.now() };
}

export async function persistLastFetched(map: Record<string, number>): Promise<void> {
    try {
        await IndexedDBService.set('meta', FILES_LAST_FETCHED_KEY, map);
    } catch (e) {
        logError('FilesSlice.persistLastFetched', e);
    }
}
