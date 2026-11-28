import type { ImpersonationResult } from '../../../api/impersonation/types';

/**
 * Every subject in the impersonated plan, not only this semester's.
 *
 * The study plan shows a fail rate on each row, and the overlay guard keeps
 * `fetchStudyPlan` — which asks for the whole real plan — from running, so the
 * impersonation slice is the only thing that can ask for the impersonated one.
 * Asking for `subjects` alone left semesters 2+ bare until each row was tapped open. Asked
 * on restore too: a relaunch starts with no rates in memory. The batch skips
 * codes it already has or has in flight.
 */
export function failRateCodes(result: ImpersonationResult): string[] {
  // The Erasmus persona has no plan: its subjects are all there is.
  const inPlan = (result.plan?.cz.blocks ?? []).flatMap((b) =>
    b.groups.flatMap((g) => g.subjects.map((s) => s.code))
  );
  return [...new Set([...Object.keys(result.subjects.data), ...inPlan])];
}
