import { fetchExamData, registerExam, unregisterExam } from '../../api/exams';
import type { ExamSubject, ExamTerm } from '../../types/exams';
import { parseRegistrationStart } from '../../utils/termUtils';
import { logError } from '../../utils/reportError';

/**
 * What a term switch came to. The student's seat is only ever at risk between
 * the unregister and the register, so every outcome says which side of that
 * line it is on, and `failed` says where the seat ended up.
 */
export type SwitchOutcome =
  | { kind: 'registered' }
  /** Nothing was changed: the old registration is exactly as it was. */
  | { kind: 'refused'; reason: 'targetUnavailable' | 'locked' | 'unverified' }
  | { kind: 'unregisterFailed'; error?: string }
  /** The new term was not registered. `seat` is read from IS, not assumed. */
  | { kind: 'failed'; error?: string; seat: 'restored' | 'lost' | 'unknown' };

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
 * IS has no "move": reIS unregisters the old term, then registers the new one,
 * so a failure in between leaves the student on NO term. Two guards follow from
 * that:
 *
 * 1. Everything checkable is checked on a fresh list BEFORE the unregister (the
 *    new term filled up or closed since the list was loaded, the old term's
 *    deregistration deadline has passed), so those cases never touch the seat.
 * 2. After a failure, the outcome is read back from IS. A rollback call that
 *    answers "ok" proves nothing; the list does.
 */
export async function switchExamTerm(
  previousTermId: string,
  termId: string
): Promise<SwitchOutcome> {
  const before = await fetchExamData('cz');
  // fetchExamData hides a failure as [] — and a switch without a look at IS is
  // exactly the one that cannot be undone.
  if (before.length === 0) return { kind: 'refused', reason: 'unverified' };

  const target = allTerms(before).find((t) => t.id === termId);
  if (!target || target.full || !target.canRegisterNow)
    return { kind: 'refused', reason: 'targetUnavailable' };

  const previous = before
    .flatMap((e) => e.sections)
    .find((s) => s.registeredTerm?.id === previousTermId)?.registeredTerm;
  const deadline = previous?.deregistrationDeadline
    ? parseRegistrationStart(previous.deregistrationDeadline)
    : null;
  if (deadline && deadline.getTime() < Date.now()) return { kind: 'refused', reason: 'locked' };

  const out = await unregisterExam(previousTermId);
  if (!out.success) return { kind: 'unregisterFailed', error: out.error };

  const res = await registerExam(termId);
  if (res.success) return { kind: 'registered' };

  const rollback = await registerExam(previousTermId);
  const after = await fetchExamData('cz');
  if (after.length === 0)
    return { kind: 'failed', error: res.error, seat: rollback.success ? 'restored' : 'unknown' };

  const now = registeredIds(after);
  if (now.has(termId)) return { kind: 'registered' };
  if (now.has(previousTermId)) return { kind: 'failed', error: res.error, seat: 'restored' };

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
    new Error(
      `no term registered after switch ${previousTermId} -> ${termId}: regErr=${res.error}; rollbackErr=${rollback.error}`
    )
  );
  return { kind: 'failed', error: res.error, seat: 'lost' };
}
