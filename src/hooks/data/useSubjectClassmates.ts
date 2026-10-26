import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { SUBJECT_CLASSMATES_STALE_MS } from '../../store/slices/createSubjectClassmatesSlice';
import type { Classmate } from '../../types/classmates';

export interface UseSubjectClassmatesResult {
  /** null until loaded; [] when loaded and empty. */
  classmates: Classmate[] | null;
  isLoading: boolean;
  error: string | undefined;
}

/**
 * Everyone taking the subject — read only while `active` (the toggle is on
 * Celý předmět). The fetch itself lives in the store, like `useClassmates`.
 */
export function useSubjectClassmates(
  courseCode: string | undefined,
  active: boolean
): UseSubjectClassmatesResult {
  const classmates = useAppStore((s) => (courseCode ? s.subjectClassmates[courseCode] : undefined));
  const loading = useAppStore((s) =>
    courseCode ? !!s.subjectClassmatesLoading[courseCode] : false
  );
  const error = useAppStore((s) => (courseCode ? s.subjectClassmatesError[courseCode] : undefined));

  useEffect(() => {
    if (!courseCode || !active) return;
    const state = useAppStore.getState();
    if (state.subjectClassmates[courseCode] === undefined) {
      state.fetchSubjectClassmatesPriority(courseCode);
      return;
    }
    const fetchedAt = state.lastSubjectClassmatesFetchedAt[courseCode];
    if (!fetchedAt || Date.now() - fetchedAt > SUBJECT_CLASSMATES_STALE_MS) {
      state.refreshSubjectClassmates(courseCode);
    }
  }, [courseCode, active]);

  return {
    classmates: classmates ?? null,
    isLoading: active && (loading || (classmates === undefined && !error)),
    error,
  };
}
