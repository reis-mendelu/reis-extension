import type { AppSlice } from '../types';
import { fetchUsageStats, type UsageStats } from '../../api/usageStats';

const WINDOW_DAYS = 30;

/**
 * Which request is allowed to publish its answer.
 *
 * Two quick clicks on the daily chart race, and without this the SLOWER
 * response wins by landing last — leaving one day's numbers under another
 * day's heading, a drill-down lying about which day it describes. A
 * monotonic token rather than store state: it is a concurrency detail of
 * this module, nothing renders from it, and putting it in the store would
 * publish a value no component may read.
 */
let latestRequest = 0;

export interface AdminStatsSlice {
  adminStats: UsageStats | null;
  adminStatsLoading: boolean;
  /** ISO date of the day the drill-down is showing; null means today. */
  adminStatsDay: string | null;
  loadAdminStats: () => Promise<void>;
  selectAdminStatsDay: (day: string | null) => Promise<void>;
}

async function load(
  set: Parameters<AppSlice<AdminStatsSlice>>[0],
  day: string | null,
  keepDayOnFailure: string | null
): Promise<void> {
  const request = ++latestRequest;
  set({ adminStatsLoading: true });
  const stats = await fetchUsageStats(WINDOW_DAYS, day ?? undefined);
  // A newer request has started since: its answer is the current one, and it
  // owns the loading flag too — clearing it here would hide a load still
  // running.
  if (request !== latestRequest) return;
  // A failed refetch keeps the payload already on screen rather than blanking
  // it — but then the selected day must stay where it was too, or the drill-down
  // would claim to be showing a day the visible payload never described.
  set({
    adminStatsLoading: false,
    ...(stats ? { adminStats: stats, adminStatsDay: day } : { adminStatsDay: keepDayOnFailure }),
  });
}

/** Test-only: drop the in-flight request token. */
export function __resetAdminStatsRequestsForTests(): void {
  latestRequest = 0;
}

export const createAdminStatsSlice: AppSlice<AdminStatsSlice> = (set, get) => ({
  adminStats: null,
  adminStatsLoading: false,
  adminStatsDay: null,
  loadAdminStats: () => load(set, get().adminStatsDay, get().adminStatsDay),
  selectAdminStatsDay: (day) => load(set, day, get().adminStatsDay),
});
