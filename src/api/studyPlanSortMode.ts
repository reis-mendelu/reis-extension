import type { StudyPlan } from '../types/studyPlan';

/**
 * Kontrola plánu has two sort modes, and IS remembers whichever one the
 * student last clicked. The parser is written against by-periods; in by-plans
 * mode a multi-plan study (program + specializace + zaměření) lists every
 * semester once per plan. So the mode is pinned on every request rather than
 * inherited. See `__tests__/studyPlanSortMode.test.ts` for the measurements.
 */
export const STUDY_PLAN_SORT_PARAM = 'razeni=obdobi';

/**
 * Block titles that occur more than once, in first-seen order. Empty for a
 * healthy parse. A non-empty result means IS served a layout the parser was
 * not written for — by-plans mode, or something new.
 */
export function repeatedSemesterTitles(plan: StudyPlan): string[] {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const { title } of plan.blocks) {
    if (seen.has(title) && !repeated.includes(title)) repeated.push(title);
    seen.add(title);
  }
  return repeated;
}
