import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export interface UseClassmatesResult {
    classmates: any[];
    isLoading: boolean;
    isPriorityLoading: boolean;
    progressStatus: string;
}

/**
 * useClassmates - Hook to access classmates data from store.
 *
 * Reads classmates and loading state from the Zustand store.
 * Triggers a store fetch if data is missing (store action is idempotent).
 */
export function useClassmates(courseCode: string | undefined, filter: 'all' | 'seminar' = 'all'): UseClassmatesResult {
    const classmatesData = useAppStore(state => courseCode ? state.classmates[courseCode] : undefined);
    const isClassmatesLoading = useAppStore(state => courseCode ? !!state.classmatesLoading[courseCode] : false);
    const isPriorityLoading = useAppStore(state => courseCode ? !!state.classmatesPriorityLoading[courseCode] : false);
    const progressStatus = useAppStore(state => courseCode ? state.classmatesProgress[courseCode] || '' : '');

    useEffect(() => {
        if (courseCode) {
            const state = useAppStore.getState();
            // Priority fetch only when classmates have never been loaded (undefined)
            // { all: [], seminar: [] } means synced with no classmates — use the normal IDB path
            if (state.classmates[courseCode] === undefined) {
                state.fetchClassmatesPriority(courseCode);
            } else {
                state.fetchClassmates(courseCode);
            }
        }
    }, [courseCode]);

    const isLoading = courseCode
        ? (isClassmatesLoading || classmatesData === undefined || (isPriorityLoading && (!classmatesData || (classmatesData.all.length === 0 && classmatesData.seminar.length === 0))))
        : false;

    return {
        classmates: classmatesData?.[filter] || [],
        isLoading,
        isPriorityLoading,
        progressStatus
    };
}
