import type { ScheduleSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

export const createScheduleSlice: AppSlice<ScheduleSlice> = (set, get) => ({
  schedule: {
    data: [],
    status: 'idle',
    weekStart: null,
  },
  fetchSchedule: async () => {
    if (get().schedule.data.length === 0) {
      set((state) => ({ schedule: { ...state.schedule, status: 'loading' } }));
    }
    try {
      const [data, weekStartStr] = await Promise.all([
        IndexedDBService.get('schedule', 'current'),
        IndexedDBService.get('meta', 'schedule_week_start'),
      ]);

      set((_state) => ({
        schedule: {
          data: data || [],
          status: 'success',
          weekStart: weekStartStr ? new Date(weekStartStr) : null,
        },
      }));

    } catch (e) {
      console.warn('[ScheduleSlice] fetchSchedule failed:', e);
      set((state) => ({ schedule: { ...state.schedule, status: 'error' } }));
    }
  },
  setSchedule: (data) => {
    set((state) => ({
      schedule: { ...state.schedule, data: data || [] },
    }));
  },

});
