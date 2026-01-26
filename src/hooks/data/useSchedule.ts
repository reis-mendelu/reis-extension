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
    weekStart: Date | null;
}

export function useSchedule(): UseScheduleResult {
    const { data, status, weekStart } = useAppStore(state => state.schedule);
    
    return { 
        schedule: data, 
        isLoaded: status !== 'loading' && status !== 'idle', 
        weekStart 
    };
}
