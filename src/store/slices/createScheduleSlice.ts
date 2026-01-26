import type { ScheduleSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createScheduleSlice: AppSlice<ScheduleSlice> = (set) => ({
  schedule: {
    data: [],
    status: 'idle',
    weekStart: null,
  },
  fetchSchedule: async () => {
    set((state) => ({ schedule: { ...state.schedule, status: 'loading' } }));
    try {
      const data = await IndexedDBService.get('schedule', 'current');
      const weekStartStr = await IndexedDBService.get('meta', 'schedule_week_start');
      
      set({
        schedule: {
          data: data || [],
          status: 'success',
          weekStart: weekStartStr ? new Date(weekStartStr) : null,
        },
      });
    } catch (error) {
      console.error('[ScheduleSlice] Fetch failed:', error);
      set((state) => ({ schedule: { ...state.schedule, status: 'error' } }));
    }
  },
  setSchedule: (data) => {
    set((state) => ({
      schedule: { ...state.schedule, data: data || [] },
    }));
  },
});
