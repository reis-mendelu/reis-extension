import { IndexedDBService } from '../../../services/storage';
import { fetchSubjectClassmates } from '../../../api/classmates';
import { getUserParams } from '../../../utils/userParams';
import type { ClassmatesData } from '../../../types/classmates';
import type { SubjectsData } from '../../../types/documents';

/**
 * The whole-subject list shares the `classmates` store with the seminar list,
 * under a prefixed key, so sign-out's `clearAll` takes both and the store's
 * schema covers both. Course codes never contain a colon.
 */
export const subjectClassmatesKey = (courseCode: string) => `subject:${courseCode}`;

/** One meta key per subject: two lists fetched at once never race on a map. */
export const subjectClassmatesFetchedKey = (courseCode: string) =>
  `classmates_subject_fetched:${courseCode}`;

export interface SubjectClassmatesResult {
  data: ClassmatesData;
  fetchedAt: number;
}

/** A list cached without its fetch time reads as stale (0), never fresh. */
export async function loadCachedSubjectClassmates(
  courseCode: string
): Promise<SubjectClassmatesResult | null> {
  const [data, fetchedAt] = await Promise.all([
    IndexedDBService.get('classmates', subjectClassmatesKey(courseCode)),
    IndexedDBService.get('meta', subjectClassmatesFetchedKey(courseCode)),
  ]);
  if (!Array.isArray(data)) return null;
  return { data, fetchedAt: typeof fetchedAt === 'number' ? fetchedAt : 0 };
}

interface FetchInput {
  courseCode: string;
  subjects: SubjectsData | null;
}

/** Returns null when there's nothing to ask IS for (no subjectId or no study). */
export async function fetchAndPersistSubjectClassmates({
  courseCode,
  subjects,
}: FetchInput): Promise<SubjectClassmatesResult | null> {
  const subjectsData =
    subjects ?? ((await IndexedDBService.get('subjects', 'current')) as SubjectsData | null);
  const subjectId = subjectsData?.data?.[courseCode]?.subjectId;
  if (!subjectId) return null;

  const userParams = await getUserParams();
  const studiumId = userParams?.studium;
  const obdobi = userParams?.obdobi;
  if (!studiumId || !obdobi) return null;

  const data = await fetchSubjectClassmates(subjectId, studiumId, obdobi);
  const fetchedAt = Date.now();
  await IndexedDBService.set('classmates', subjectClassmatesKey(courseCode), data);
  await IndexedDBService.set('meta', subjectClassmatesFetchedKey(courseCode), fetchedAt);
  return { data, fetchedAt };
}
