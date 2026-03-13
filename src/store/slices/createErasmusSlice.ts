import type { ErasmusSlice, AppSlice } from '../types';
import { fetchErasmusReports, getStoredErasmusData } from '../../api/erasmus';
import { loggers } from '../../utils/logger';

export const createErasmusSlice: AppSlice<ErasmusSlice> = (set) => ({
  erasmusData: null,
  erasmusLoading: false,
  fetchErasmusReports: async () => {
    set({ erasmusLoading: true });
    try {
      const cached = await getStoredErasmusData();
      if (cached) set({ erasmusData: cached });

      const data = await fetchErasmusReports();
      if (data) set({ erasmusData: data });
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] Fetch failed:', err);
    } finally {
      set({ erasmusLoading: false });
    }
  },
});
