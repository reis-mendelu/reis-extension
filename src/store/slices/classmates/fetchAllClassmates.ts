import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import type { ClassmatesData } from '../../../types/classmates';
import type { SubjectsData } from '../../../types/documents';

interface FetchAllInput {
    subjects: SubjectsData | null;
}

/**
 * Load every enrolled course's cached classmates from IDB and return them
 * keyed by courseCode. Mirrors loadAllFilesFromCache — eager batch read,
 * no per-component lazy fetch, no race against invalidation.
 */
export async function loadAllClassmatesFromCache({ subjects }: FetchAllInput): Promise<Record<string, ClassmatesData>> {
    try {
        const subjectsData = subjects?.data
            ?? ((await IndexedDBService.get('subjects', 'current')) as SubjectsData | null)?.data;
        const courseCodes = subjectsData ? Object.keys(subjectsData) : [];
        if (courseCodes.length === 0) return {};

        const entries = await Promise.all(
            courseCodes.map(async (code) => [code, await IndexedDBService.get('classmates', code)] as const)
        );

        const map: Record<string, ClassmatesData> = {};
        for (const [code, value] of entries) {
            if (Array.isArray(value)) map[code] = value;
        }
        return map;
    } catch (e) {
        logError('ClassmatesSlice.loadAllClassmatesFromCache', e);
        return {};
    }
}
