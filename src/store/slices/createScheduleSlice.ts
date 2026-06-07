import type { ScheduleSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

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

      set(() => ({
        schedule: {
          data: data || [],
          status: 'success',
          weekStart: weekStartStr ? new Date(weekStartStr) : null,
        },
      }));

    } catch (e) {
      logError('ScheduleSlice.fetchSchedule', e);
      set((state) => ({ schedule: { ...state.schedule, status: 'error' } }));
    }
  },
  setSchedule: (data) => {
    // A transient/failed IS fetch can resolve to [], and a sync push would
    // otherwise wipe the currently-displayed schedule. Keep old data on screen
    // until real new data is available to replace it (mirrors setExams).
    if ((!data || data.length === 0) && get().schedule.data.length > 0) return;
    set((state) => ({
      schedule: { ...state.schedule, data: data || [] },
    }));
  },

});
