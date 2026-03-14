import type { ErasmusSlice, AppSlice } from '../types';
import { fetchErasmusReports, getStoredErasmusData } from '../../api/erasmus';
import { ERASMUS_COUNTRIES } from '../../constants/erasmusCountries';
import { loggers } from '../../utils/logger';

const DEFAULT_COUNTRY = ERASMUS_COUNTRIES.find(c => c.id === '705')!; // Slovenia

export const createErasmusSlice: AppSlice<ErasmusSlice> = (set, get) => ({
  erasmusData: null,
  erasmusLoading: false,
  erasmusCountryFile: DEFAULT_COUNTRY.file,
  setErasmusCountry: async (file: string) => {
    set({ erasmusCountryFile: file, erasmusLoading: true });
    try {
      const cached = await getStoredErasmusData(file);
      if (cached) set({ erasmusData: cached });

      const data = await fetchErasmusReports(file);
      if (data) set({ erasmusData: data });
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] Fetch failed:', err);
    } finally {
      set({ erasmusLoading: false });
    }
  },
  fetchErasmusReports: async () => {
    const file = get().erasmusCountryFile;
    set({ erasmusLoading: true });
    try {
      const cached = await getStoredErasmusData(file);
      if (cached) set({ erasmusData: cached });

      const data = await fetchErasmusReports(file);
      if (data) set({ erasmusData: data });
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] Fetch failed:', err);
    } finally {
      set({ erasmusLoading: false });
    }
  },
});
