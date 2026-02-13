import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useSyncStatus } from './useSyncStatus';
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
export function useFiles(courseCode: string | undefined): UseFilesResult {
    const filesMap = useAppStore((state) => state.files);
    const loadingMap = useAppStore((state) => state.filesLoading);
    const fetchFiles = useAppStore((state) => state.fetchFiles);
    const { isSyncing } = useSyncStatus();

    const subjectFiles = courseCode ? filesMap[courseCode] : undefined;
    const isSubjectLoading = courseCode ? !!loadingMap[courseCode] : false;

    useEffect(() => {
        // Fetch if missing (undefined)
        // If it's an empty array [], it means we've already fetched and found no files
        const shouldFetch = courseCode && subjectFiles === undefined;
        if (shouldFetch) {
            fetchFiles(courseCode);
        }
    }, [courseCode, fetchFiles, subjectFiles]);

    // Loading state: 
    // 1. Explicitly loading this subject from IndexedDB
    // 2. Global Sync is active AND we have no data yet (undefined or empty [])
    const isLoading = isSubjectLoading || (isSyncing && (!subjectFiles || subjectFiles.length === 0));

    console.log(`[useFiles] ${courseCode}: files=${subjectFiles?.length ?? 'none'}, isLoading=${isLoading}, isSyncing=${isSyncing}`);

    return {
        files: subjectFiles ?? null,
        isLoading
    };
}
