import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ParsedFile } from '../../types/documents';

export interface UseFilesResult {
    files: ParsedFile[] | null;
    isLoading: boolean;
}

const STALE_MS = 60_000;

/**
 * useFiles - Hook to access subject files from store.
 *
 * Reads files and loading state from the Zustand store.
 * Triggers a store fetch if data is missing, OR a background refresh if the
 * cached data is older than STALE_MS (stale-while-revalidate).
 */
export function useFiles(courseCode?: string): UseFilesResult {
    const subjectFiles = useAppStore(state => courseCode ? state.files[courseCode] : undefined);
    const isSubjectLoading = useAppStore(state => courseCode ? !!state.filesLoading[courseCode] : false);
    const lastSync = useAppStore(state => state.syncStatus.lastSync);

    useEffect(() => {
        if (!courseCode) return;
        const state = useAppStore.getState();
        if (state.files[courseCode] === undefined) {
            state.fetchFilesPriority(courseCode);
            return;
        }
        const fetchedAt = state.lastFilesFetchedAt[courseCode];
        if (!fetchedAt || Date.now() - fetchedAt > STALE_MS) {
            state.refreshFilesForSubject(courseCode);
        } else {
            state.fetchFiles(courseCode);
        }
    }, [courseCode, lastSync]);

    const isLoading = courseCode ? (isSubjectLoading || subjectFiles === undefined) : false;

    return {
        files: subjectFiles ?? null,
        isLoading,
    };
}
