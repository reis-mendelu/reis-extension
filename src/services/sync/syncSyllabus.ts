import { IndexedDBService } from '../storage';
import { fetchSyllabus, findSubjectId, SYLLABUS_FETCH_FAILED } from '../../api/syllabus';
import type { SyllabusRequirements } from '../../types/documents';
import { logError } from '../../utils/reportError';

/**
 * Fetch and cache a single subject's syllabus in the language being read.
 * Returns it, or undefined on failure.
 *
 * One language, stored as a single-language record stamped with `language`:
 * the reader (createSyllabusSlice) already refetches a record whose language
 * does not match the UI, so a switch costs one request on the next open rather
 * than every open costing two.
 */
export async function fetchAndCacheSingleSyllabus(
  courseCode: string,
  language: 'cz' | 'en',
  courseId?: string,
  subjectName?: string
): Promise<SyllabusRequirements | undefined> {
  let activeId = courseId;
  if (!activeId) {
    activeId = (await findSubjectId(courseCode, subjectName)) || undefined;
  }

  if (!activeId) {
    return undefined;
  }

  const syllabus = await fetchSyllabus(activeId, language);

  // `fetchSyllabus` degrades gracefully rather than throwing: it returns
  // SYLLABUS_FETCH_FAILED as the requirementsText. Caching that would render a
  // raw English marker string AS the syllabus, indistinguishable from real text
  // for every later reader — so a failure is logged and never stored.
  if (syllabus.requirementsText === SYLLABUS_FETCH_FAILED) {
    logError('Sync.fetchAndCacheSingleSyllabus', new Error('syllabus fetch failed'), {
      courseCode,
      activeId,
      language,
    });
    return undefined;
  }

  await IndexedDBService.set('syllabuses', courseCode, syllabus);
  return syllabus;
}
