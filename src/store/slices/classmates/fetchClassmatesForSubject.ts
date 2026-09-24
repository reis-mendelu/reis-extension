import { IndexedDBService } from '../../../services/storage';
import { logError } from '../../../utils/reportError';
import { fetchSeminarGroupIds, fetchClassmates } from '../../../api/classmates';
import { getUserParams } from '../../../utils/userParams';
import type { ClassmatesData } from '../../../types/classmates';
import type { SubjectsData } from '../../../types/documents';

export const CLASSMATES_LAST_FETCHED_KEY = 'classmates_last_fetched';
/** courseCode → true for subjects with no seminar group (lecture-only). */
export const CLASSMATES_NO_SEMINAR_KEY = 'classmates_no_seminar';

interface FetchInput {
  courseCode: string;
  subjects: SubjectsData | null;
}

export interface FetchClassmatesResult {
  data: ClassmatesData;
  fetchedAt: number;
  /**
   * The subject has no seminar group, so `data` is empty for want of a cvičení
   * to list — not because nobody takes the subject.
   */
  noSeminar: boolean;
}

/** Returns null when there's nothing to fetch (no subjectId or no userParams). */
export async function fetchAndPersistClassmates({
  courseCode,
  subjects,
}: FetchInput): Promise<FetchClassmatesResult | null> {
  const subjectsData =
    subjects ?? ((await IndexedDBService.get('subjects', 'current')) as SubjectsData | null);
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
    return { data: empty, fetchedAt: Date.now(), noSeminar: true };
  }

  const roster = await fetchClassmates(subjectId, studiumId, obdobi, skupinaId);
  await IndexedDBService.set('classmates', courseCode, roster);
  return { data: roster, fetchedAt: Date.now(), noSeminar: false };
}

export async function persistLastClassmatesFetched(map: Record<string, number>): Promise<void> {
  try {
    await IndexedDBService.set('meta', CLASSMATES_LAST_FETCHED_KEY, map);
  } catch (e) {
    logError('ClassmatesSlice.persistLastFetched', e);
  }
}

export async function persistClassmatesNoSeminar(map: Record<string, boolean>): Promise<void> {
  try {
    await IndexedDBService.set('meta', CLASSMATES_NO_SEMINAR_KEY, map);
  } catch (e) {
    logError('ClassmatesSlice.persistNoSeminar', e);
  }
}
