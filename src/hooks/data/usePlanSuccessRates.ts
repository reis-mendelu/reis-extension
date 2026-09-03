import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { StudyPlan } from '../../types/studyPlan';

/**
 * Loads the pass/fail statistics for every subject in the plan.
 *
 * Extracted so the PHONE gets them too. The desktop had this effect inside
 * `useSubjectsData`, which the phone's SubjectsScreen does not use — so on the
 * phone `successRates` only ever held the subjects whose drawer had been
 * opened, and the failure-rate chip appeared on those rows alone. On a real
 * iPad that was one row out of eight, which reads as "this subject is
 * dangerous and the others are fine" rather than "we only fetched one".
 *
 * An effect rather than a store/service call, matching what the desktop has
 * always done here: the trigger is "a plan is on screen", and the batch is
 * idempotent (it filters to codes not already loaded or in flight), so calling
 * it from several surfaces is safe.
 */
export function usePlanSuccessRates(plan: StudyPlan | null | undefined): void {
  useEffect(() => {
    if (!plan) return;
    const codes = plan.blocks.flatMap((b) =>
      b.groups.flatMap((g) => g.subjects.map((s) => s.code))
    );
    if (codes.length > 0) void useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [plan]);
}
