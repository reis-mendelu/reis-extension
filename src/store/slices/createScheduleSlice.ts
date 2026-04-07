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
      const [data, weekStartStr, isPartial] = await Promise.all([
        IndexedDBService.get('schedule', 'current'),
        IndexedDBService.get('meta', 'schedule_week_start'),
        IndexedDBService.get('meta', 'schedule_is_partial'),
      ]);
      
      set((state) => ({
        schedule: {
          data: data || [],
          status: 'success',
          weekStart: weekStartStr ? new Date(weekStartStr) : null,
          isPartial: state.schedule.isPartial === false ? false : !!isPartial
        },
      }));

    } catch (e) {
      console.warn('[ScheduleSlice] fetchSchedule failed:', e);
      set((state) => ({ schedule: { ...state.schedule, status: 'error' } }));
    }
  },
  setSchedule: (data, isPartial) => {
    set((state) => ({
      schedule: { ...state.schedule, data: data || [], isPartial },
    }));
  },

});
