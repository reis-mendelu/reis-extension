import { useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { StudyPlan, Zamerani } from '@/types/studyPlan';
import { computeFailRate } from './computeFailRate';
import type { ZameraniProgress } from './SubjectsPanelHeader';
import { isRealCredits, normalizeZameraniName, buildSubjectSemesters, buildSubjectToZameranis } from './utils';

/**
 * Plan-derived lookups shared by the current-semester view (SubjectsPanel) and
 * the full study-plan page (StudyPlanPage). Both surfaces derive from the same
 * StudyPlan, so the derivation lives here once rather than being duplicated.
 */
export function useSubjectsData(plan: StudyPlan | null) {
  const successRates = useAppStore(s => s.successRates);

  // Ensure success rates are fetched for every subject in the plan. Lives here
  // (the shared derivation point) so both the current-semester panel and the
  // full study-plan page load their own data regardless of mount order. The
  // batch fetch is idempotent, so calling it from both surfaces is safe.
  useEffect(() => {
    if (!plan) return;
    const codes = plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code)));
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [plan]);

  const zameraniLookup = useMemo(() => {
    const map = new Map<string, Zamerani>();
    if (!plan?.zameranis) return map;
    for (const z of plan.zameranis) map.set(normalizeZameraniName(z.name), z);
    return map;
  }, [plan]);

  const subjectSemesters = useMemo(() => buildSubjectSemesters(plan), [plan]);
  const subjectToZameranis = useMemo(() => buildSubjectToZameranis(plan), [plan]);

  const zameraniProgress = useMemo(() => {
    const out = new Map<string, ZameraniProgress>();
    if (!plan?.zameranis) return out;
    const subjectByCode = new Map<string, { isEnrolled: boolean; isFulfilled: boolean }>();
    for (const b of plan.blocks) for (const g of b.groups) for (const s of g.subjects) {
      subjectByCode.set(s.code, { isEnrolled: s.isEnrolled, isFulfilled: s.isFulfilled });
    }
    for (const z of plan.zameranis) {
      let enrolled = 0, fulfilled = 0;
      for (const m of z.subjects) {
        const hit = subjectByCode.get(m.code);
        if (!hit) continue;
        if (hit.isFulfilled) fulfilled++;
        else if (hit.isEnrolled) enrolled++;
      }
      const touched = enrolled + fulfilled > 0;
      out.set(normalizeZameraniName(z.name), { enrolled, fulfilled, total: z.subjects.length, touched });
    }
    return out;
  }, [plan]);

  const failRates = useMemo(() => {
    const map: Record<string, number | null> = {};
    if (!plan) return map;
    for (const block of plan.blocks) for (const group of block.groups) for (const s of group.subjects) {
      map[s.code] = computeFailRate(successRates[s.code]);
    }
    return map;
  }, [plan, successRates]);

  const enrolledCredits = useMemo(() => {
    if (!plan) return 0;
    let total = 0;
    for (const block of plan.blocks) for (const group of block.groups) for (const s of group.subjects) {
      if (s.isEnrolled && isRealCredits(s.credits)) total += s.credits;
    }
    return total;
  }, [plan]);

  return { zameraniLookup, subjectSemesters, subjectToZameranis, zameraniProgress, failRates, enrolledCredits };
}
