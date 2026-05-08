import { useAppStore } from '../../store/useAppStore';
import type { SubjectZaznamnik } from '../../types/zaznamnik';

export interface UseZaznamnikResult {
    data: SubjectZaznamnik | null;
    isLoading: boolean;
}

export function useZaznamnik(courseCode: string | undefined): UseZaznamnikResult {
    const data = useAppStore(s => courseCode ? s.zaznamnik?.[courseCode] : undefined);
    const hydrated = useAppStore(s => s.zaznamnikHydrated);

    return {
        data: data ?? null,
        // Skeleton only until first IDB hydration completes; afterwards undefined → empty state.
        isLoading: !hydrated && data === undefined,
    };
}
