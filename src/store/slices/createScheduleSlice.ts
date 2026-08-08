import type { ScheduleSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';

export const createScheduleSlice: AppSlice<ScheduleSlice> = (set, get) => ({
  schedule: {
    data: [],
    status: 'idle',
  },
  fetchSchedule: async () => {
    if (get().schedule.data.length === 0) {
      set((state) => ({ schedule: { ...state.schedule, status: 'loading' } }));
    }
    try {
      const data = await IndexedDBService.get('schedule', 'current');

      set(() => ({
        schedule: {
          data: data || [],
          status: 'success',
        },
      }));
    } catch (e) {
      logError('ScheduleSlice.fetchSchedule', e);
      set((state) => ({ schedule: { ...state.schedule, status: 'error' } }));
    }
  },
  setSchedule: (data) => {
    set((state) => ({
      schedule: { ...state.schedule, data: data || [] },
    }));
  },
});
