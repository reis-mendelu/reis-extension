import type { SuccessRateSlice, AppSlice } from '../types';
import { getStoredSuccessRates, fetchSubjectSuccessRates } from '../../api/successRate';
import { loggers } from '../../utils/logger';

export const createSuccessRateSlice: AppSlice<SuccessRateSlice> = (set, get) => ({
    successRates: {},
    successRatesLoading: {},
    successRatesGlobalLoaded: false,
    fetchSuccessRate: async (courseCode) => {
        if (get().successRatesLoading[courseCode]) return;

        set(state => ({
            successRatesLoading: { ...state.successRatesLoading, [courseCode]: true }
        }));

        try {
            // Try storage first
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

            // Not cached — fetch from API
            loggers.ui.info('[SuccessRateSlice] Fetching from API:', courseCode);
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
