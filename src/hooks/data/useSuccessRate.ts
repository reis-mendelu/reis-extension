/**
 * useSuccessRate - Hook to access success rate data from store.
 *
 * Reads from Zustand store. Triggers a store fetch if data is missing.
 */
import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { SubjectSuccessRate } from '../../types/documents';

export interface UseSuccessRateResult {
    stats: SubjectSuccessRate | null;
    loading: boolean;
    hasFetched: boolean;
    isGlobalLoaded: boolean;
    refresh: () => Promise<void>;
}

export function useSuccessRate(courseCode: string | undefined): UseSuccessRateResult {
    const stats = useAppStore(state => courseCode ? state.successRates[courseCode] : undefined);
    const loading = useAppStore(state => courseCode ? !!state.successRatesLoading[courseCode] : false);
    const isGlobalLoaded = useAppStore(state => state.successRatesGlobalLoaded);

    useEffect(() => {
        if (courseCode) {
            useAppStore.getState().fetchSuccessRate(courseCode);
        }
    }, [courseCode]);

    const refresh = async () => {
        if (courseCode) {
            await useAppStore.getState().fetchSuccessRate(courseCode);
        }
    };

    return {
        stats: stats ?? null,
        loading,
        hasFetched: !!stats,
        isGlobalLoaded,
        refresh
    };
}
