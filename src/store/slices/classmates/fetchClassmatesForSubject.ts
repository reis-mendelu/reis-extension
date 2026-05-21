import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import { fetchSeminarGroupIds, fetchClassmates } from '../../../api/classmates';
import { getUserParams } from '../../../utils/userParams';
import type { ClassmatesData } from '../../../types/classmates';
import type { SubjectsData } from '../../../types/documents';

export const CLASSMATES_LAST_FETCHED_KEY = 'classmates_last_fetched';

interface FetchInput {
    courseCode: string;
    subjects: SubjectsData | null;
}

export interface FetchClassmatesResult {
    data: ClassmatesData;
    fetchedAt: number;
}

/** Returns null when there's nothing to fetch (no subjectId or no userParams). */
export async function fetchAndPersistClassmates(
    { courseCode, subjects }: FetchInput,
): Promise<FetchClassmatesResult | null> {
    const subjectsData = subjects
        ?? ((await IndexedDBService.get('subjects', 'current')) as SubjectsData | null);
    const subject = subjectsData?.data?.[courseCode];
    const subjectId = subject?.subjectId;
    if (!subjectId) return null;

    const userParams = await getUserParams();
    const studiumId = userParams?.studium;
    const obdobi = userParams?.obdobi;
    if (!studiumId || !obdobi) return null;

    const groupMap = await fetchSeminarGroupIds(studiumId, obdobi);
    const skupinaId = groupMap[subjectId];
    if (!skupinaId) {
        // Not enrolled in a seminar group — persist [] so the SWR window starts.
        const empty: ClassmatesData = [];
        await IndexedDBService.set('classmates', courseCode, empty);
        return { data: empty, fetchedAt: Date.now() };
    }

    const roster = await fetchClassmates(subjectId, studiumId, obdobi, skupinaId);
    await IndexedDBService.set('classmates', courseCode, roster);
    return { data: roster, fetchedAt: Date.now() };
}

export async function persistLastClassmatesFetched(map: Record<string, number>): Promise<void> {
    try {
        await IndexedDBService.set('meta', CLASSMATES_LAST_FETCHED_KEY, map);
    } catch (e) {
        logError('ClassmatesSlice.persistLastFetched', e);
    }
}
