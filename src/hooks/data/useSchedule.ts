/**
 * useSchedule - Hook to access schedule data from storage.
 * 
 * Returns stored data immediately (stale-while-revalidate pattern).
 * Subscribes to sync updates for automatic refresh.
 */

import { useState, useEffect } from 'react';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import type { BlockLesson } from '../../types/calendarTypes';

export interface UseScheduleResult {
    schedule: BlockLesson[];
    isLoaded: boolean;
    weekStart: Date | null;
}

export function useSchedule(): UseScheduleResult {
    const [schedule, setSchedule] = useState<BlockLesson[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [weekStart, setWeekStart] = useState<Date | null>(null);

    useEffect(() => {
        const loadFromStorage = async () => {
             // 1. Try IndexedDB
             const data = await IndexedDBService.get('schedule', 'current');
             const storedWeekStart = await IndexedDBService.get('meta', 'schedule_week_start');

            if (data) {
                setSchedule(data);
            }
            if (storedWeekStart) {
                setWeekStart(new Date(storedWeekStart));
            }
            setIsLoaded(true);
        };

        // Initial load
        loadFromStorage();

        // Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            loadFromStorage();
        });

        return unsubscribe;
    }, []);

    return { schedule, isLoaded, weekStart };
}
