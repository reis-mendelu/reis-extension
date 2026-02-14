import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Assessment } from '../../types/documents';

export interface UseAssessmentsResult {
    assessments: Assessment[] | null;
    isLoading: boolean;
}

/**
 * useAssessments - Hook to access assessment data from store.
 *
 * Reads assessments and loading state from the Zustand store.
 * Triggers a store fetch when courseCode changes (store action is idempotent).
 */
export function useAssessments(courseCode: string | undefined): UseAssessmentsResult {
    const subjectAssessments = useAppStore(state => courseCode ? state.assessments[courseCode] : undefined);
    const isSubjectLoading = useAppStore(state => courseCode ? !!state.assessmentsLoading[courseCode] : false);
    const isSyncing = useAppStore(state => state.syncStatus.isSyncing);

    useEffect(() => {
        if (courseCode) {
            useAppStore.getState().fetchAssessments(courseCode);
        }
    }, [courseCode]);

    const isLoading = isSubjectLoading || (isSyncing && (!subjectAssessments || subjectAssessments.length === 0));

    return {
        assessments: subjectAssessments ?? null,
        isLoading
    };
}
