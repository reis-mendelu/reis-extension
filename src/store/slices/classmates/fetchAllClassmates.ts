import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import type { ClassmatesData } from '../../../types/classmates';
import type { SubjectsData } from '../../../types/documents';

interface FetchAllInput {
    subjects: SubjectsData | null;
}

/**
 * Returns null when subjects are unknown (cold boot). Callers MUST skip set()
 * in that case — an empty map would clobber concurrent writes.
 */
export async function loadAllClassmatesFromCache(
    { subjects }: FetchAllInput,
): Promise<Record<string, ClassmatesData> | null> {
    try {
        const subjectsData = subjects?.data
            ?? ((await IndexedDBService.get('subjects', 'current')) as SubjectsData | null)?.data;
        const courseCodes = subjectsData ? Object.keys(subjectsData) : [];
        if (courseCodes.length === 0) return null;

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
        return null;
    }
}
