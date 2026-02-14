/**
 * useSchedule - Hook to access schedule data from store.
 * 
 * Returns data from Zustand global store.
 * Initialization is handled by the store itself.
 */

import { useAppStore } from '../../store/useAppStore';
import type { BlockLesson } from '../../types/calendarTypes';

export interface UseScheduleResult {
    schedule: BlockLesson[];
    isLoaded: boolean;
    status: 'idle' | 'loading' | 'success' | 'error';
    isPartial: boolean;
    isSyncing: boolean;
    weekStart: Date | null;
}

export function useSchedule(): UseScheduleResult {
    const data = useAppStore(state => state.schedule.data);
    const status = useAppStore(state => state.schedule.status);
    const isPartial = useAppStore(state => !!state.schedule.isPartial);
    const isSyncing = useAppStore(state => state.isSyncing);
    const weekStart = useAppStore(state => state.schedule.weekStart);

    return {
        schedule: data,
        isLoaded: status !== 'loading' && status !== 'idle',
        status,
        isPartial,
        isSyncing,
        weekStart
    };
}



