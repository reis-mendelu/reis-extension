import { useAppStore } from '../../store/useAppStore';
import type { SubjectZaznamnik } from '../../types/zaznamnik';

export interface UseZaznamnikResult {
  data: SubjectZaznamnik | null;
  isLoading: boolean;
  /** The last fetch failed and nothing better is known: null in the store. */
  isFailed: boolean;
}

export function useZaznamnik(courseCode: string | undefined): UseZaznamnikResult {
  const data = useAppStore((s) => (courseCode ? s.zaznamnik?.[courseCode] : undefined));
  const hydrated = useAppStore((s) => s.zaznamnikHydrated);
  // A retry, or the fetch a past-semester subject's drawer starts when it
  // opens (loadPastZaznamnik, called from the actions that open a drawer).
  const retrying = useAppStore((s) => (courseCode ? !!s.zaznamnikLoading[courseCode] : false));

  return {
    data: data ?? null,
    // Skeleton until first IDB hydration completes, and while a fetch runs;
    // afterwards undefined → empty state.
    isLoading: (!hydrated && data === undefined) || retrying,
    // null, not undefined: fetchSubjectZaznamnik returns null only on failure,
    // and setZaznamnikBatch never writes it over real data.
    isFailed: data === null,
  };
}
