import type { SuccessRateSlice, AppSlice } from '../types';
import type { SubjectSuccessRate } from '../../types/documents';
import {
  getStoredSuccessRates,
  fetchSubjectSuccessRates,
  isStaleForVersion,
} from '../../api/successRate';
import { ensureSuccessRateVersion, getKnownSuccessRateVersion } from '../../api/successRateVersion';
import { loggers } from '../../utils/logger';

const batchInFlight = new Set<string>();

// Stamped too, so a subject the CDN has no file for is asked once per version
// rather than on every batch.
const placeholder = (courseCode: string, version: string | null): SubjectSuccessRate => ({
  courseCode,
  stats: [],
  lastUpdated: '',
  ...(version === null ? {} : { cdnVersion: version }),
});

export const createSuccessRateSlice: AppSlice<SuccessRateSlice> = (set, get) => ({
  successRates: {},
  successRatesLoading: {},
  successRatesGlobalLoaded: false,
  fetchSuccessRateBatch: async (courseCodes) => {
    const missing = courseCodes.filter((c) => !get().successRates[c] && !batchInFlight.has(c));
    const claimed = new Set(missing);
    for (const c of missing) batchInFlight.add(c);

    try {
      const [stored, known] = await Promise.all([
        getStoredSuccessRates(),
        getKnownSuccessRateVersion(),
      ]);
      if (stored) set({ successRatesGlobalLoaded: true });

      const fromCache: Record<string, SubjectSuccessRate> = {};
      const toFetch: string[] = [];
      for (const code of missing) {
        const cached = stored?.data[code];
        if (cached && !isStaleForVersion(cached, known)) fromCache[code] = cached;
        else toFetch.push(code);
      }

      if (Object.keys(fromCache).length > 0) {
        set((state) => ({ successRates: { ...state.successRates, ...fromCache } }));
      }

      // Cached entries are shown first; the version check (at most one request
      // every few hours) then decides whether anything on screen — from this
      // batch or an earlier one — predates the current reis-data version.
      const version = await ensureSuccessRateVersion();
      const shown = get().successRates;
      const stale = Object.keys(shown).filter(
        (c) => (claimed.has(c) || !batchInFlight.has(c)) && isStaleForVersion(shown[c]!, version)
      );
      for (const c of stale) {
        claimed.add(c);
        batchInFlight.add(c);
      }

      if (toFetch.length === 0 && stale.length === 0) return;

      const result = await fetchSubjectSuccessRates([...toFetch, ...stale], version);
      const updates: Record<string, SubjectSuccessRate> = {};
      for (const code of toFetch) {
        updates[code] = result.data[code] ?? placeholder(code, version);
      }
      for (const code of stale) {
        // A failed re-fetch leaves the old entry in `result`; keep showing it.
        const next = result.data[code];
        if (next) updates[code] = next;
        else if (shown[code]!.stats.length === 0) updates[code] = placeholder(code, version);
      }
      set((state) => ({ successRates: { ...state.successRates, ...updates } }));
    } catch (err) {
      loggers.ui.error('[SuccessRateSlice] Batch fetch failed:', err);
    } finally {
      for (const c of claimed) batchInFlight.delete(c);
    }
  },
  fetchSuccessRate: async (courseCode) => {
    if (get().successRatesLoading[courseCode]) return;

    if (!get().successRates[courseCode]) {
      set((state) => ({
        successRatesLoading: { ...state.successRatesLoading, [courseCode]: true },
      }));
    }

    try {
      const [stored, known] = await Promise.all([
        getStoredSuccessRates(),
        getKnownSuccessRateVersion(),
      ]);
      if (stored) {
        set({ successRatesGlobalLoaded: true });
      }

      const cached = stored?.data[courseCode];
      if (cached && !isStaleForVersion(cached, known)) {
        set((state) => ({
          successRates: { ...state.successRates, [courseCode]: cached },
          successRatesLoading: { ...state.successRatesLoading, [courseCode]: false },
        }));
      }

      // Shown already if it was current as far as we knew; the check may
      // still find a newer version and send us past the cache.
      const version = await ensureSuccessRateVersion();
      if (cached && !isStaleForVersion(cached, version)) return;

      const result = await fetchSubjectSuccessRates([courseCode], version);
      set((state) => ({
        successRates: {
          ...state.successRates,
          ...(result.data[courseCode] ? { [courseCode]: result.data[courseCode] } : {}),
        },
        successRatesLoading: { ...state.successRatesLoading, [courseCode]: false },
      }));
    } catch (err) {
      loggers.ui.error('[SuccessRateSlice] Fetch failed:', err);
      set((state) => ({
        successRatesLoading: { ...state.successRatesLoading, [courseCode]: false },
      }));
    }
  },
});
