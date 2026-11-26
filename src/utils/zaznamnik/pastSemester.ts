import type { AppState } from '../../store/types';
import type { SubjectInfo } from '../../types/documents';

/**
 * Points of a subject from an earlier semester.
 *
 * The sync fetches Záznamník only for the current semester (subjectScope), and
 * IS keys every Záznamník page by period: a past subject's points live under
 * the period it was taken in, not the current one. `periodId` is set on a past
 * subject when its semester is folded into the subject list
 * (services/sync/pastSemesterSubjects); a current subject has none.
 */
export function zaznamnikPeriod(
  subject: Pick<SubjectInfo, 'periodId'> | undefined,
  currentObdobi: string
): string {
  return subject?.periodId ?? currentObdobi;
}

type Probe = Pick<
  AppState,
  | 'impersonation'
  | 'studiumId'
  | 'obdobiId'
  | 'zaznamnikHydrated'
  | 'zaznamnik'
  | 'zaznamnikLoading'
  | 'subjects'
>;

export type PastZaznamnikVerdict = 'fetch' | 'wait' | 'skip';

/**
 * What opening a subject's drawer should do about its past-semester points.
 * `wait` is an input that is still on its way (IndexedDB hydration, the ids,
 * the subject list, the past subject itself, or its periodId, folded in by a sync): the request
 * is remembered and asked again when it lands. `skip` is final: a current
 * subject, nothing to ask IS for, already stored or loading.
 */
export function pastZaznamnikVerdict(s: Probe, courseCode: string): PastZaznamnikVerdict {
  if (s.impersonation) return 'skip';
  if (!s.studiumId || !s.obdobiId || !s.zaznamnikHydrated) return 'wait';
  const subject = s.subjects?.data?.[courseCode];
  if (!subject) return 'wait';
  if (!subject.subjectId) return 'skip';
  // A current subject has no periodId and neither has a past one that a sync
  // has not folded in yet (a cache from before periodId existed), and the two
  // cannot be told apart: wait, and the next subject list settles it. The
  // pending entry of a current subject costs one string until the app closes.
  if (!subject.periodId) return 'wait';
  if (subject.periodId === s.obdobiId) return 'skip';
  // Same filter the sync applies: no flag, nothing to ask IS for.
  if (!subject.hasPrubezne && !subject.hasTest) return 'skip';
  // Hydrated, so "undefined" means nothing is stored (not even a failure).
  return s.zaznamnik[courseCode] === undefined && !s.zaznamnikLoading[courseCode]
    ? 'fetch'
    : 'skip';
}

/** True when the points of this past subject should be fetched right now. */
export function needsPastZaznamnik(s: Probe, courseCode: string): boolean {
  return pastZaznamnikVerdict(s, courseCode) === 'fetch';
}
