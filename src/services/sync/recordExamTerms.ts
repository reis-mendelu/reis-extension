import type { ExamSubject } from '../../types/exams';
import type { SyncDomain } from '../../types/messages/base';
import { persistExamTerms } from './newExamTerms';
import { addUnseenTerms } from './examTermsUnseen';
import { logError } from '../../utils/reportError';

/**
 * A sync push's part in the "Nový termín" rows, kept out of useAppLogic's
 * listener. Answers the unseen new terms to put in the store, or null when
 * this push says nothing about exams. Never throws: a failed check must not
 * cost the rest of the push.
 *
 * "No exams" arrives as an arrival without a list (the sync keeps the cached
 * one rather than let an empty read wipe it). It still starts the known
 * record, or a student with no dates yet would have their first published one
 * taken as the baseline. Adding nothing to a record that exists changes nothing.
 */
export async function recordExamTerms(push: {
  exams?: ExamSubject[];
  loaded?: SyncDomain[];
}): Promise<string[] | null> {
  try {
    if (push.exams) {
      const found = await persistExamTerms(push.exams);
      return await addUnseenTerms(found.map((t) => t.key));
    }
    if (push.loaded?.includes('exams')) await persistExamTerms([]);
  } catch (err) {
    logError('Sync.recordExamTerms', err);
  }
  return null;
}
