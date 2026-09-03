/**
 * Sync syllabus for all subjects from IS Mendelu to storage.
 */

import { IndexedDBService } from '../storage';
import { fetchSyllabus, findSubjectId, SYLLABUS_FETCH_FAILED } from '../../api/syllabus';
import type { SyllabusRequirements } from '../../types/documents';
import { logError } from '../../utils/reportError';

export async function syncSyllabus(): Promise<void> {
  const subjectsData = await IndexedDBService.get('subjects', 'current');
  if (!subjectsData || !subjectsData.data) return;

  const subjects = Object.entries(subjectsData.data);

  for (const [courseCode, subject] of subjects) {
    try {
      const predmetId = subject.subjectId;
      if (!predmetId) continue;

      const [czSyllabus, enSyllabus] = await Promise.all([
        fetchSyllabus(predmetId, 'cz'),
        fetchSyllabus(predmetId, 'en'),
      ]);

      await IndexedDBService.set('syllabuses', courseCode, {
        cz: czSyllabus,
        en: enSyllabus,
      });
    } catch (e) {
      logError('Sync.syncSyllabus', e, { courseCode });
    }
  }
}

/**
 * Fetch and cache a single subject's syllabus (dual-language) to IDB.
 * Returns the syllabus for the requested language, or undefined on failure.
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

  const [czSyllabus, enSyllabus] = await Promise.all([
    fetchSyllabus(activeId, 'cz'),
    fetchSyllabus(activeId, 'en'),
  ]);

  // `fetchSyllabus` degrades gracefully rather than throwing: it returns
  // SYLLABUS_FETCH_FAILED as the requirementsText. Its own doc says callers
  // that cache "can tell it apart from a real syllabus and avoid storing a
  // failure" — the bulk sync does exactly that (injector/syncService.ts:408),
  // this path did not. So a failed fetch was written to IDB and then rendered
  // AS the syllabus: a raw English marker string in a Czech UI, and
  // indistinguishable from real text for every later reader.
  //
  // Both-or-neither, deliberately. A partial `{ cz }` write would break the
  // record's shape: the reader branches on `'cz' in data && 'en' in data`, so
  // a half record falls through to the single-syllabus branch and the wrapper
  // object itself gets treated as a syllabus.
  const failed = (s: SyllabusRequirements) => s.requirementsText === SYLLABUS_FETCH_FAILED;
  if (failed(czSyllabus) || failed(enSyllabus)) {
    logError('Sync.fetchAndCacheSingleSyllabus', new Error('syllabus fetch failed'), {
      courseCode,
      activeId,
      czFailed: failed(czSyllabus),
      enFailed: failed(enSyllabus),
    });
    return undefined;
  }

  await IndexedDBService.set('syllabuses', courseCode, {
    cz: czSyllabus,
    en: enSyllabus,
  });

  return language === 'en' ? enSyllabus : czSyllabus;
}
