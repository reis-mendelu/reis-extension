import type { ScheduleSlice, AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import { syncService } from '../../services/sync/SyncService';

/**
 * Which refresh is the current one. A request that outlived its 15s backstop
 * can still answer later — after a newer refresh has started — and must not
 * end that one. Each trigger takes a new number; only the current one may stop.
 */
let refreshGeneration = 0;

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
  scheduleRefreshing: false,
  /**
   * The calendar's refresh: the timetable only, ~3s, where the full sync it
   * replaced was ~30s of data the calendar never shows. Ends on the refresh's
   * answer rather than on data, the same contract as `triggerExamsRefresh`,
   * because an empty read pushes no data at all. The timer is the backstop for
   * an answer that never comes.
   */
  triggerScheduleRefresh: () => {
    if (get().scheduleRefreshing) return;
    set({ scheduleRefreshing: true });
    const generation = ++refreshGeneration;
    const stop = () => {
      if (generation === refreshGeneration && get().scheduleRefreshing)
        set({ scheduleRefreshing: false });
    };
    syncService
      .triggerScheduleRefresh()
      .catch((e) => logError('ScheduleSlice.triggerScheduleRefresh', e))
      .finally(stop);
    setTimeout(stop, 15_000);
  },
});
