import { IndexedDBService } from '../../services/storage/IndexedDBService';

/**
 * Stores whose contents belong to ONE study. Everything else stays: the
 * timetable is the person's (IS returns both studies' lessons in it), and
 * notes, hidden items, custom events, files and syllabuses are the student's
 * own or keyed by a subject code that means the same thing in either study.
 */
const STUDY_STORES = [
  'subjects',
  'exams',
  'study_plan',
  'grade_history',
  'cvicne_tests',
  'odevzdavarny',
  'zaznamnik',
  'classmates',
] as const;

/** `meta` is deleted by key, never cleared (see `IndexedDBService.clearAll`). */
const STUDY_META_KEYS = ['study_stats', 'study_comparison', 'current_attendance'];

/**
 * Past semesters are keyed by `obdobi` alone, and two studies at one faculty
 * share their `obdobi` ids — the other study's entry would be served as this
 * one's and its fetch skipped.
 */
const STUDY_META_PREFIX = 'past_semester_';

/**
 * Drop the cached data of the study the app is leaving, in THIS context's
 * IndexedDB. The extension has two (see `injector/CLAUDE.md`): `getUserParams`
 * runs in both, and each calls this when it moves to another study.
 */
export async function clearStudyData(): Promise<void> {
  await Promise.all(STUDY_STORES.map((s) => IndexedDBService.clear(s)));
  const meta = await IndexedDBService.getAllWithKeys('meta');
  const keys = [
    ...STUDY_META_KEYS,
    ...meta.map((m) => m.key).filter((k) => k.startsWith(STUDY_META_PREFIX)),
  ];
  await Promise.all(keys.map((k) => IndexedDBService.delete('meta', k)));
}
