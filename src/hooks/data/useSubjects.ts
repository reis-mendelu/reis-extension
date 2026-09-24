import { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useSyncStatus } from './useSyncStatus';
import type { SubjectsData, SubjectInfo } from '../../types/documents';

export interface UseSubjectsResult {
  subjects: SubjectsData | null;
  getSubject: (courseCode: string) => SubjectInfo | null;
  isLoaded: boolean;
}

/**
 * useSubjects - Hook to access subject data from store.
 *
 * Replaces local fetching logic with Zustand store selectors.
 * Combines local store loading with global sync status for robust UI.
 */
export function useSubjects(): UseSubjectsResult {
  const subjects = useAppStore((state) => state.subjects);
  const storeLoading = useAppStore((state) => state.subjectsLoading);
  const { isSyncing } = useSyncStatus();

  // Final loading state: Store is fetching from IDB OR Global Sync is active (on first load)
  const isLoading = storeLoading || (isSyncing && !subjects);

  // Helper to get a single subject by code (memoized)
  const getSubject = useCallback(
    (courseCode: string): SubjectInfo | null => {
      if (!subjects) return null;
      return subjects.data[courseCode] || null;
    },
    [subjects]
  );

  return {
    subjects,
    getSubject,
    isLoaded: !isLoading,
  };
}
