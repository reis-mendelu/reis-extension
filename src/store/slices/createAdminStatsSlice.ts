import type { AppSlice } from '../types';
import { fetchUsageStats, type UsageStats } from '../../api/usageStats';

const WINDOW_DAYS = 30;

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
  set({ adminStatsLoading: true });
  const stats = await fetchUsageStats(WINDOW_DAYS, day ?? undefined);
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
  loadAdminStats: () => load(set, get().adminStatsDay, get().adminStatsDay),
  selectAdminStatsDay: (day) => load(set, day, get().adminStatsDay),
});
