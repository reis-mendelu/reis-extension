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

/**
 * True when opening this subject's Záznamník should fetch its points: a past
 * subject with assessment, nothing stored for it (not even a failure), and IDB
 * hydration done (the points may already be cached there). The tab reads it as
 * "loading" so there is no blank frame before the fetch starts.
 */
export function needsPastZaznamnik(s: Probe, courseCode: string): boolean {
  if (s.impersonation || !s.studiumId || !s.obdobiId || !s.zaznamnikHydrated) return false;
  const subject = s.subjects?.data?.[courseCode];
  if (!subject?.subjectId || !subject.periodId || subject.periodId === s.obdobiId) return false;
  // Same filter the sync applies: no flag, nothing to ask IS for.
  if (!subject.hasPrubezne && !subject.hasTest) return false;
  return s.zaznamnik[courseCode] === undefined && !s.zaznamnikLoading[courseCode];
}
