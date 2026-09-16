import type { AppSlice } from '../types';
import { fetchUsageStats, type UsageStats } from '../../api/usageStats';

const WINDOW_DAYS = 30;

export interface AdminStatsSlice {
  adminStats: UsageStats | null;
  adminStatsLoading: boolean;
  /** ISO date of the day the drill-down is showing; null means today. */
  adminStatsDay: string | null;
  /**
   * Monotonic token deciding which request may publish its answer.
   *
   * Two quick clicks on the daily chart race, and without this the SLOWER
   * response wins by landing last — leaving one day's numbers under another
   * day's heading, a drill-down lying about which day it describes. Nothing
   * renders from it; it lives in the slice because this store owns all of the
   * app's state, ad-hoc module globals included.
   */
  adminStatsRequestId: number;
  loadAdminStats: () => Promise<void>;
  selectAdminStatsDay: (day: string | null) => Promise<void>;
}

type Set = Parameters<AppSlice<AdminStatsSlice>>[0];
type Get = Parameters<AppSlice<AdminStatsSlice>>[1];

async function load(set: Set, get: Get, day: string | null): Promise<void> {
  const keepDayOnFailure = get().adminStatsDay;
  const request = get().adminStatsRequestId + 1;
  set({ adminStatsRequestId: request, adminStatsLoading: true });

  const stats = await fetchUsageStats(WINDOW_DAYS, day ?? undefined);

  // A newer request has started since: its answer is the current one, and it
  // owns the loading flag too — clearing it here would hide a load still
  // running.
  if (get().adminStatsRequestId !== request) return;

  // A failed refetch keeps the payload already on screen rather than blanking
  // it — but then the selected day must stay where it was too, or the drill-down
  // would claim to be showing a day the visible payload never described.
  set({
    adminStatsLoading: false,
    ...(stats ? { adminStats: stats, adminStatsDay: day } : { adminStatsDay: keepDayOnFailure }),
  });
}

export const createAdminStatsSlice: AppSlice<AdminStatsSlice> = (set, get) => ({
  adminStats: null,
  adminStatsLoading: false,
  adminStatsDay: null,
  adminStatsRequestId: 0,
  loadAdminStats: () => load(set, get, get().adminStatsDay),
  selectAdminStatsDay: (day) => load(set, get, day),
});
