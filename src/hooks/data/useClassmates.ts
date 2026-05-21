import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Classmate } from '../../types/classmates';

export interface UseClassmatesResult {
    /** null while unloaded; [] when loaded and empty; populated otherwise. */
    classmates: Classmate[] | null;
    isLoading: boolean;
    error: string | undefined;
}

const STALE_MS = 24 * 60 * 60 * 1000; // 24h — rosters don't change within a semester

export function useClassmates(courseCode: string | undefined): UseClassmatesResult {
    const classmates = useAppStore(state => courseCode ? state.classmates[courseCode] : undefined);
    const isSubjectLoading = useAppStore(state => courseCode ? !!state.classmatesLoading[courseCode] : false);
    const error = useAppStore(state => courseCode ? state.classmatesError[courseCode] : undefined);

    useEffect(() => {
        if (!courseCode) return;
        const state = useAppStore.getState();
        if (state.classmates[courseCode] === undefined) {
            state.fetchClassmatesPriority(courseCode);
            return;
        }
        const fetchedAt = state.lastClassmatesFetchedAt[courseCode];
        if (!fetchedAt || Date.now() - fetchedAt > STALE_MS) {
            state.refreshClassmatesForSubject(courseCode);
        }
    }, [courseCode]);

    return {
        classmates: classmates ?? null,
        isLoading: courseCode ? (isSubjectLoading || classmates === undefined) : false,
        error,
    };
}
