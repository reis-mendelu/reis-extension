import type { AppSlice, ErrorReportingSlice } from '../types';
import { IndexedDBService } from '../../services/storage';

const STORAGE_KEY = 'reis_error_reporting_enabled';

export const createErrorReportingSlice: AppSlice<ErrorReportingSlice> = (set) => ({
    errorReportingEnabled: true,
    loadErrorReportingEnabled: async () => {
        try {
            const stored = await IndexedDBService.get('meta', STORAGE_KEY) as boolean | undefined;
            if (typeof stored === 'boolean') set({ errorReportingEnabled: stored });
        } catch { /* default already true */ }
    },
    setErrorReportingEnabled: async (enabled: boolean) => {
        set({ errorReportingEnabled: enabled });
        try { await IndexedDBService.set('meta', STORAGE_KEY, enabled); } catch { /* ignore */ }
    },
});
