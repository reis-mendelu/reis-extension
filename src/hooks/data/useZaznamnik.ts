import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { needsPastZaznamnik } from '../../utils/zaznamnik/pastSemester';
import type { SubjectZaznamnik } from '../../types/zaznamnik';

export interface UseZaznamnikResult {
  data: SubjectZaznamnik | null;
  isLoading: boolean;
  /** The last fetch failed and nothing better is known: null in the store. */
  isFailed: boolean;
}

/**
 * `load` is for the Záznamník tab itself: opening it fetches the points of a
 * subject from an earlier semester, which the sync skips. Readers that only
 * show a count (the phone sheet's tab badge) leave it off, so merely opening
 * a past subject's drawer on Soubory costs nothing.
 */
export function useZaznamnik(
  courseCode: string | undefined,
  { load = false }: { load?: boolean } = {}
): UseZaznamnikResult {
  const data = useAppStore((s) => (courseCode ? s.zaznamnik?.[courseCode] : undefined));
  const hydrated = useAppStore((s) => s.zaznamnikHydrated);
  const retrying = useAppStore((s) => (courseCode ? !!s.zaznamnikLoading[courseCode] : false));
  // A past subject whose points are not here yet: loading, not an empty tab.
  const pending = useAppStore((s) => (courseCode ? needsPastZaznamnik(s, courseCode) : false));

  useEffect(() => {
    if (load && courseCode && pending) void useAppStore.getState().loadPastZaznamnik(courseCode);
  }, [load, courseCode, pending]);

  return {
    data: data ?? null,
    // Skeleton until first IDB hydration completes, and while a retry runs;
    // afterwards undefined → empty state.
    isLoading: (!hydrated && data === undefined) || retrying || (load && pending),
    // null, not undefined: fetchSubjectZaznamnik returns null only on failure,
    // and setZaznamnikBatch never writes it over real data.
    isFailed: data === null,
  };
}
