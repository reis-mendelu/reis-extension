import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Classmate } from '../../types/classmates';

export interface UseExamClassmatesResult {
    /** null while unloaded; [] when loaded and empty; populated otherwise. */
    classmates: Classmate[] | null;
    isLoading: boolean;
    error: string | undefined;
}

const STALE_MS = 24 * 60 * 60 * 1000; // 24h — exam rosters don't shift within a window

export function useExamClassmates(terminId: string | undefined): UseExamClassmatesResult {
    const classmates = useAppStore(state => terminId ? state.examClassmates[terminId] : undefined);
    const isTerminLoading = useAppStore(state => terminId ? !!state.examClassmatesLoading[terminId] : false);
    const error = useAppStore(state => terminId ? state.examClassmatesError[terminId] : undefined);

    useEffect(() => {
        if (!terminId) return;
        const state = useAppStore.getState();
        if (state.examClassmates[terminId] === undefined) {
            state.fetchExamClassmatesPriority(terminId);
            return;
        }
        const fetchedAt = state.lastExamClassmatesFetchedAt[terminId];
        if (!fetchedAt || Date.now() - fetchedAt > STALE_MS) {
            state.refreshExamClassmatesForTermin(terminId);
        }
    }, [terminId]);

    return {
        classmates: classmates ?? null,
        isLoading: terminId ? (isTerminLoading || classmates === undefined) : false,
        error,
    };
}
