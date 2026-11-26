import type { SubjectInfo } from '../../types/documents';

/**
 * Folds one cached past semester into the subject list. A subject the list
 * already has (the current semester's, or an earlier fold) wins. The rest keep
 * the period they came from: IS serves a subject's points only under that
 * period, and the Záznamník tab fetches them there when it is opened.
 */
export function foldPastSemesterSubjects(
  target: Record<string, SubjectInfo>,
  cached: Record<string, SubjectInfo>,
  periodId: string
): void {
  for (const [code, info] of Object.entries(cached)) {
    if (!target[code]) target[code] = { ...info, periodId };
  }
}
