import type { AppSlice, ErrorReportingSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

const STORAGE_KEY = 'reis_error_reporting_enabled';

export const createErrorReportingSlice: AppSlice<ErrorReportingSlice> = (set) => ({
  errorReportingEnabled: true,
  errorReportingHydrated: false,
  loadErrorReportingEnabled: async () => {
    try {
      const stored = (await IndexedDBService.get('meta', STORAGE_KEY)) as boolean | undefined;
      if (typeof stored === 'boolean') set({ errorReportingEnabled: stored });
      set({ errorReportingHydrated: true });
    } catch {
      // Deliberately stays UNHYDRATED, which keeps reporting closed for
      // this session: if the stored choice cannot be read we do not know
      // it, and guessing the optimistic default is what transmits for the
      // student who opted out. The next launch retries.
    }
  },
  setErrorReportingEnabled: async (enabled: boolean) => {
    set({ errorReportingEnabled: enabled, errorReportingHydrated: true });
    try {
      await IndexedDBService.set('meta', STORAGE_KEY, enabled);
    } catch {
      /* ignore */
    }
  },
});
