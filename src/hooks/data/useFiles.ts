import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ParsedFile } from '../../types/documents';

export interface UseFilesResult {
    files: ParsedFile[] | null;
    isLoading: boolean;
}

/**
 * useFiles - Hook to access subject files from store.
 *
 * Reads files and loading state from the Zustand store.
 * Triggers a store fetch if data is missing (store action is idempotent).
 */
export function useFiles(courseCode?: string): UseFilesResult {
    const subjectFiles = useAppStore(state => courseCode ? state.files[courseCode] : undefined);
    const isSubjectLoading = useAppStore(state => courseCode ? !!state.filesLoading[courseCode] : false);
    const lastSync = useAppStore(state => state.syncStatus.lastSync);

    useEffect(() => {
        if (courseCode) {
            const state = useAppStore.getState();
            if (state.files[courseCode] === undefined) {
                state.fetchFilesPriority(courseCode);
            } else {
                state.fetchFiles(courseCode);
            }
        }
    }, [courseCode, lastSync]);

    const isLoading = courseCode ? (isSubjectLoading || subjectFiles === undefined) : false;

    return {
        files: subjectFiles ?? null,
        isLoading,
    };
}
