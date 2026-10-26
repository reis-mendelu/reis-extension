import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AppState } from '../../store/types';

/**
 * One subject's submission boxes, matched by IS predmet id (`subjectId`) —
 * the id the box's syllabus link carries. Names differ between the plan, the
 * schedule and this page, so matching by name missed boxes.
 */
export function useOdevzdavarny(subjectId?: string) {
  const all = useAppStore((state: AppState) => state.odevzdavarny);
  const status = useAppStore((state: AppState) => state.odevzdavarnyStatus);
  const assignments = useMemo(
    () => (subjectId ? all.filter((a) => a.courseId === subjectId) : []),
    [all, subjectId]
  );
  return { assignments, status };
}
