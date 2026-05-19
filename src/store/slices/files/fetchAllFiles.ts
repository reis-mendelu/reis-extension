import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import type { ParsedFile, SubjectsData } from '../../../types/documents';
import type { Language } from '../../types';

interface FetchAllInput {
    language: Language;
    subjects: SubjectsData | null;
}

/**
 * Load every enrolled course's cached files from IDB and return them
 * keyed by courseCode in the current language.
 */
export async function loadAllFilesFromCache({ language, subjects }: FetchAllInput): Promise<Record<string, ParsedFile[]>> {
    try {
        const subjectsData = subjects?.data
            ?? ((await IndexedDBService.get('subjects', 'current')) as SubjectsData | null)?.data;
        const courseCodes = subjectsData ? Object.keys(subjectsData) : [];
        if (courseCodes.length === 0) return {};

        const entries = await Promise.all(
            courseCodes.map(async (code) => [code, await IndexedDBService.get('files', code)] as const)
        );

        const filesMap: Record<string, ParsedFile[]> = {};
        for (const [code, value] of entries) {
            if (value && 'cz' in value && 'en' in value) {
                filesMap[code] = language === 'en' ? value.en : value.cz;
            } else if (Array.isArray(value)) {
                filesMap[code] = value;
            }
        }
        return filesMap;
    } catch (e) {
        logError('FilesSlice.loadAllFilesFromCache', e);
        return {};
    }
}
