import { useAppStore } from '../../store/useAppStore';
import { useSyncStatus } from './useSyncStatus';
import type { SubjectZaznamnik } from '../../types/zaznamnik';

export interface UseZaznamnikResult {
    data: SubjectZaznamnik | null;
    isLoading: boolean;
}

export function useZaznamnik(courseCode: string | undefined): UseZaznamnikResult {
    const data = useAppStore(s => courseCode ? s.zaznamnik[courseCode] : undefined);
    const { isSyncing } = useSyncStatus();

    return {
        data: data ?? null,
        isLoading: data === undefined && isSyncing,
    };
}
