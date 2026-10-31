import type { ExamSubject } from '../../types/exams';
import { allTermKeys, findNewTerms, type NewExamTerm } from '../../utils/newExamTerms';
import { IndexedDBService } from '../storage/IndexedDBService';
import { STORAGE_KEYS } from '../storage/keys';

/** The 'meta' key holding every exam term id this device has seen. */
export const KNOWN_TERMS_META_KEY = 'exam_terms_known';

interface StoredKnown {
  ids: string[];
}

async function persist(fresh: readonly ExamSubject[]): Promise<NewExamTerm[]> {
  // Signed out since the push arrived: the same guard as the submission boxes.
  if (!(await IndexedDBService.get('meta', STORAGE_KEYS.USER_PARAMS))) return [];
  const stored = (await IndexedDBService.get('meta', KNOWN_TERMS_META_KEY)) as
    StoredKnown | undefined;
  const found = findNewTerms(stored && new Set(stored.ids), fresh);
  // Only ever added to: a partial or empty read must not make a term new again.
  const ids = [...new Set([...(stored?.ids ?? []), ...allTermKeys(fresh)])];
  await IndexedDBService.set('meta', KNOWN_TERMS_META_KEY, { ids });
  return found;
}

// One at a time, like the box record: two overlapping pushes would both read
// the old record and announce the same term twice.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Remembers a sync's exam list and says which registrable terms are new since
 * this device last saw a list. Nothing here leaves the device.
 */
export function persistExamTerms(fresh: readonly ExamSubject[]): Promise<NewExamTerm[]> {
  const run = queue.then(() => persist(fresh));
  queue = run.catch(() => undefined);
  return run;
}

/** Another study: forget every term, so its first sync is a fresh baseline. */
export function resetExamTerms(): Promise<void> {
  const run = queue.then(() => IndexedDBService.delete('meta', KNOWN_TERMS_META_KEY));
  queue = run.catch(() => undefined);
  return run;
}
