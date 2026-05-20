import { useAppStore } from '../../store/useAppStore';
import type { Classmate } from '../../types/classmates';

export interface UseClassmatesResult {
    classmates: Classmate[];
    isLoading: boolean;
}

/**
 * useClassmates — selector-only read of seminar classmates for a course.
 *
 * Data flows: syncService (content script) → REIS_SYNC_UPDATE message →
 * useAppLogic writes to extension-origin IDB → useAppLogic calls
 * fetchAllClassmates() which batch-loads every enrolled course's IDB entry
 * into the store. This hook is a pure read — no useEffect, no lazy fetch.
 *
 * The `isLoading` flag is driven entirely by the sync skeleton-guard pattern
 * in ClassmatesTab (isSyncing && classmates.length === 0).
 */
export function useClassmates(courseCode: string | undefined): UseClassmatesResult {
    const classmates = useAppStore(state => courseCode ? state.classmates[courseCode] : undefined);

    return {
        classmates: classmates ?? [],
        isLoading: false,
    };
}
