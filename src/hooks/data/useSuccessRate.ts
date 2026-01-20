/**
 * Hook to access success rate data for a specific subject.
 * Simplified: reads from storage, fetches from API if not cached.
 */
import { useState, useEffect, useCallback } from 'react';
import { getStoredSuccessRates, fetchSubjectSuccessRates } from '../../api/successRate';
import type { SubjectSuccessRate } from '../../types/documents';
import { loggers } from '../../utils/logger';

export interface UseSuccessRateResult {
    stats: SubjectSuccessRate | null;
    loading: boolean;
    hasFetched: boolean;
    isGlobalLoaded: boolean;
    refresh: () => Promise<void>;
}

/**
 * Hook to access success rate data for a specific subject.
 * Reads from storage, fetches from API if not cached or expired.
 */
export function useSuccessRate(courseCode: string | undefined): UseSuccessRateResult {
    const [stats, setStats] = useState<SubjectSuccessRate | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [isGlobalLoaded, setIsGlobalLoaded] = useState(false);

    const loadFromStorage = useCallback(async () => {
        const stored = await getStoredSuccessRates();
        setIsGlobalLoaded(!!stored);
        
        if (courseCode && stored?.data[courseCode]) {
            setStats(stored.data[courseCode]);
            setHasFetched(true);
            return true;
        }
        return false;
    }, [courseCode]);

    const doFetch = useCallback(async (code: string) => {
        setLoading(true);
        try {
            loggers.ui.info('[useSuccessRate] Fetching stats for:', code);
            const result = await fetchSubjectSuccessRates([code]);
            if (result.data[code]) {
                setStats(result.data[code]);
            }
            setHasFetched(true);
        } catch (err) {
            loggers.ui.error('[useSuccessRate] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load and fetch if needed
    useEffect(() => {
        async function init() {
            if (!courseCode) {
                setStats(null);
                setHasFetched(false);
                return;
            }

            const wasCached = await loadFromStorage();
            if (!wasCached && !hasFetched && !loading) {
                loggers.ui.info('[useSuccessRate] No cached data, fetching from API', courseCode);
                await doFetch(courseCode);
            }
        }

        init();
    }, [courseCode, loadFromStorage, hasFetched, loading, doFetch]);

    const refresh = useCallback(async () => {
        if (courseCode) {
            await doFetch(courseCode);
        }
    }, [courseCode, doFetch]);

    return { stats, loading, hasFetched: hasFetched || !!stats, isGlobalLoaded, refresh };
}
