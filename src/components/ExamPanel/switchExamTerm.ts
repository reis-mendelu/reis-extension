import { fetchExamData } from '../../api/exams';
import { swapExamTerm } from '../../api/examSwap';
import type { ExamSubject, ExamTerm } from '../../types/exams';
import { parseRegistrationStart } from '../../utils/termUtils';
import { logError } from '../../utils/reportError';

/**
 * What a term switch came to. Every outcome says whether the student's seat is
 * safe, and `failed` says where it ended up, read from IS.
 */
export type SwitchOutcome =
  | { kind: 'registered' }
  /** Nothing was sent: the old registration is exactly as it was. */
  | { kind: 'refused'; reason: 'targetUnavailable' | 'locked' | 'unverified' }
  /** The new term was not registered. `seat` is read from IS, not assumed. */
  | { kind: 'failed'; error?: string; seat: 'kept' | 'lost' | 'unknown' };

const allTerms = (exams: ExamSubject[]): ExamTerm[] =>
  exams.flatMap((e) => e.sections.flatMap((s) => s.terms));

const registeredIds = (exams: ExamSubject[]): Set<string> =>
  new Set(
    exams.flatMap((e) =>
      e.sections.flatMap((s) => (s.registeredTerm?.id ? [s.registeredTerm.id] : []))
    )
  );

/**
 * Change an exam registration from `previousTermId` to `termId`.
 *
 * IS does this itself: registering a term while holding another of the same
 * kind opens a confirmation whose form registers the new term and drops the old
 * one as one operation. So reIS never releases the seat on purpose (it used to
 * unregister first and register second, and a failure in between left the
 * student on no term). Two things surround the swap:
 *
 * 1. A fresh list is checked BEFORE it, so a target that filled up or closed
 *    since the list was loaded, or an old term that can no longer be left, is
 *    refused without sending anything.
 * 2. The outcome is read back from IS afterwards. IS's confirmation page is a
 *    hint; the list is the truth.
 */
export async function switchExamTerm(
  previousTermId: string,
  termId: string
): Promise<SwitchOutcome> {
  const before = await fetchExamData('cz');
  // fetchExamData hides a failure as [] — and a change made without a look at
  // IS is exactly the one that cannot be checked.
  if (before.length === 0) return { kind: 'refused', reason: 'unverified' };

  const target = allTerms(before).find((t) => t.id === termId);
  if (!target || target.full || !target.canRegisterNow)
    return { kind: 'refused', reason: 'targetUnavailable' };

  const previous = before
    .flatMap((e) => e.sections)
    .find((s) => s.registeredTerm?.id === previousTermId)?.registeredTerm;
  // Not registered where we thought: IS would not offer a swap from there.
  if (!previous) return { kind: 'refused', reason: 'unverified' };
  const deadline = previous.deregistrationDeadline
    ? parseRegistrationStart(previous.deregistrationDeadline)
    : null;
  if (deadline && deadline.getTime() < Date.now()) return { kind: 'refused', reason: 'locked' };

  const res = await swapExamTerm(previousTermId, termId);

  const after = await fetchExamData('cz');
  if (after.length === 0)
    return res.success
      ? { kind: 'registered' }
      : { kind: 'failed', error: res.error, seat: 'unknown' };

  const now = registeredIds(after);
  if (now.has(termId)) return { kind: 'registered' };
  if (now.has(previousTermId)) return { kind: 'failed', error: res.error, seat: 'kept' };

  // Neither term is held. "Lost" is only true if the section itself holds
  // nothing: another tab or device may have registered a third term meanwhile,
  // and then the student is registered, just not where we expected.
  const section = after
    .flatMap((e) => e.sections)
    .find((s) => s.terms.some((t) => t.id === termId || t.id === previousTermId));
  if (!section || section.registeredTerm?.id)
    return { kind: 'failed', error: res.error, seat: 'unknown' };

  logError(
    'switchExamTerm.seatLost',
    new Error(`no term registered after swap ${previousTermId} -> ${termId}: err=${res.error}`)
  );
  return { kind: 'failed', error: res.error, seat: 'lost' };
}
