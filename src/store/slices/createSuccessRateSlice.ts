import type { SuccessRateSlice, AppSlice } from '../types';
import { getStoredSuccessRates, fetchSubjectSuccessRates } from '../../api/successRate';
import { loggers } from '../../utils/logger';

const batchInFlight = new Set<string>();

export const createSuccessRateSlice: AppSlice<SuccessRateSlice> = (set, get) => ({
    successRates: {},
    successRatesLoading: {},
    successRatesGlobalLoaded: false,
    fetchSuccessRateBatch: async (courseCodes) => {
        const missing = courseCodes.filter(c => !get().successRates[c] && !batchInFlight.has(c));
        if (missing.length === 0) return;

        for (const c of missing) batchInFlight.add(c);

        try {
            const stored = await getStoredSuccessRates();
            if (stored) set({ successRatesGlobalLoaded: true });

            const fromCache: Record<string, import('../../types/documents').SubjectSuccessRate> = {};
            const toFetch: string[] = [];
            for (const code of missing) {
                if (stored?.data[code]) fromCache[code] = stored.data[code];
                else toFetch.push(code);
            }

            if (Object.keys(fromCache).length > 0) {
                set(state => ({ successRates: { ...state.successRates, ...fromCache } }));
            }

            if (toFetch.length > 0) {
                const result = await fetchSubjectSuccessRates(toFetch);
                const updates: Record<string, import('../../types/documents').SubjectSuccessRate> = {};
                for (const code of toFetch) {
                    updates[code] = result.data[code] ?? { courseCode: code, stats: [], lastUpdated: '' };
                }
                set(state => ({ successRates: { ...state.successRates, ...updates } }));
            }
        } catch (err) {
            loggers.ui.error('[SuccessRateSlice] Batch fetch failed:', err);
        } finally {
            for (const c of missing) batchInFlight.delete(c);
        }
    },
    fetchSuccessRate: async (courseCode) => {
        if (get().successRatesLoading[courseCode]) return;

        set(state => ({
            successRatesLoading: { ...state.successRatesLoading, [courseCode]: true }
        }));

        try {
            const stored = await getStoredSuccessRates();
            if (stored) {
                set({ successRatesGlobalLoaded: true });
            }

            if (stored?.data[courseCode]) {
                set(state => ({
                    successRates: { ...state.successRates, [courseCode]: stored.data[courseCode] },
                    successRatesLoading: { ...state.successRatesLoading, [courseCode]: false }
                }));
                return;
            }

            const result = await fetchSubjectSuccessRates([courseCode]);
            set(state => ({
                successRates: {
                    ...state.successRates,
                    ...(result.data[courseCode] ? { [courseCode]: result.data[courseCode] } : {})
                },
                successRatesLoading: { ...state.successRatesLoading, [courseCode]: false }
            }));
        } catch (err) {
            loggers.ui.error('[SuccessRateSlice] Fetch failed:', err);
            set(state => ({
                successRatesLoading: { ...state.successRatesLoading, [courseCode]: false }
            }));
        }
    },
});
