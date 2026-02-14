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
    const isSyncing = useAppStore(state => state.syncStatus.isSyncing);

    useEffect(() => {
        if (courseCode) {
            useAppStore.getState().fetchFiles(courseCode);
        }
    }, [courseCode]);

    const isLoading = courseCode
        ? (isSubjectLoading || subjectFiles === undefined || (isSyncing && (!subjectFiles || subjectFiles.length === 0)))
        : false;

    return {
        files: subjectFiles ?? null,
        isLoading
    };
}
