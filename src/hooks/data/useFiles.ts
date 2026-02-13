import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ParsedFile } from '../../types/documents';

export interface UseFilesResult {
    files: ParsedFile[] | null;
    isLoading: boolean;
}

/**
 * useFiles - Hook to access subject files from store.
 *
 * Selects filtered files from central store.
 * Combines local store loading with global sync status.
 * Re-fetches when language changes.
 */
export function useFiles(courseCode?: string): UseFilesResult {
    const [isSubjectLoading, setIsSubjectLoading] = useState(false);
    const subjectFiles = useAppStore(state => courseCode ? state.files[courseCode] : undefined);
    const isSyncing = useAppStore(state => (state as any).isSyncing); // Use cast if linter still complains, though AppState should have it

    useEffect(() => {
        if (!courseCode) return;
        if (subjectFiles === undefined) {
            setIsSubjectLoading(true);
            useAppStore.getState().fetchFiles(courseCode).finally(() => {
                setIsSubjectLoading(false);
            });
        }
    }, [courseCode, subjectFiles]);

    // Robust loading state:
    // 1. Explicitly fetching this subject (isSubjectLoading)
    // 2. We don't have files in store at all (subjectFiles === undefined)
    // 3. Global sync is active and we have no files yet (isSyncing && length === 0)
    const isLoading = courseCode ? (isSubjectLoading || subjectFiles === undefined || (isSyncing && (!subjectFiles || subjectFiles.length === 0))) : false;

    if (courseCode) {
        console.log(`[useFiles] ${courseCode}: files=${subjectFiles?.length ?? 'none'}, isLoading=${isLoading}, isSyncing=${isSyncing}`);
    }

    return {
        files: subjectFiles ?? null,
        isLoading
    };
}
