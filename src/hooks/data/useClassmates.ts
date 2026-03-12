import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Classmate } from '../../types/classmates';

export interface UseClassmatesResult {
    classmates: Classmate[];
    isLoading: boolean;
}

/**
 * useClassmates — reads seminar classmates for a course from the Zustand store.
 *
 * Data flows: syncService (content script) → REIS_SYNC_UPDATE message →
 * useAppLogic writes to extension-origin IDB → this hook reads IDB via the slice.
 *
 * Re-fetches from IDB whenever classmates becomes undefined (e.g. after
 * invalidateClassmates() is called when sync completes).
 */
export function useClassmates(courseCode: string | undefined): UseClassmatesResult {
    const classmates = useAppStore(state => courseCode ? state.classmates[courseCode] : undefined);
    const isLoading = useAppStore(state => courseCode ? !!state.classmatesLoading[courseCode] : false);

    useEffect(() => {
        if (courseCode && classmates === undefined && !isLoading) {
            useAppStore.getState().fetchClassmates(courseCode);
        }
    }, [courseCode, classmates, isLoading]);

    return {
        classmates: classmates ?? [],
        isLoading: isLoading || (classmates === undefined && !!courseCode),
    };
}
