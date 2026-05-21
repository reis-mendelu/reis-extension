import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import { fetchExamClassmates } from '../../../api/terminyInfo';
import type { Classmate } from '../../../types/classmates';

export const EXAM_CLASSMATES_LAST_FETCHED_KEY = 'exam_classmates_last_fetched';

interface FetchInput {
    terminId: string;
    studiumId: string | null;
    obdobiId: string | null;
}

export interface FetchExamClassmatesResult {
    data: Classmate[];
    fetchedAt: number;
}

/** Returns null when there's nothing to fetch (no terminId or no studium/obdobi). */
export async function fetchAndPersistExamClassmates(
    { terminId, studiumId, obdobiId }: FetchInput,
): Promise<FetchExamClassmatesResult | null> {
    if (!terminId || !studiumId || !obdobiId) return null;

    const data = await fetchExamClassmates(terminId, studiumId, obdobiId);
    await IndexedDBService.set('classmates', `exam:${terminId}`, data);
    return { data, fetchedAt: Date.now() };
}

export async function persistLastExamClassmatesFetched(
    map: Record<string, number>,
): Promise<void> {
    try {
        await IndexedDBService.set('meta', EXAM_CLASSMATES_LAST_FETCHED_KEY, map);
    } catch (e) {
        logError('ExamClassmatesSlice.persistLastFetched', e);
    }
}
