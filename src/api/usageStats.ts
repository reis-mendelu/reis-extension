import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

const Group = z.object({ key: z.string(), devices: z.number() });
const DayShape = z.object({
  day: z.string(),
  active: z.number(),
  new: z.number(),
  returning: z.number(),
});
const Schema = z.object({
  today: z.number(),
  d7: z.number(),
  d30: z.number(),
  daily: z.array(DayShape),
  by_platform: z.array(Group),
  by_faculty: z.array(Group),
  day: DayShape.extend({ by_platform: z.array(Group) }).nullable(),
});

export interface UsageGroup {
  key: string;
  /** -1 means "under 5" — the RPC's suppression floor. Never clamp it. */
  devices: number;
}

export interface DailyUsage {
  /** ISO date. `newDevices + returningDevices === active`, always. */
  day: string;
  active: number;
  newDevices: number;
  returningDevices: number;
}

export interface DayDetail extends DailyUsage {
  byPlatform: UsageGroup[];
}

export interface UsageStats {
  today: number;
  d7: number;
  d30: number;
  daily: DailyUsage[];
  byPlatform: UsageGroup[];
  byFaculty: UsageGroup[];
  day: DayDetail | null;
}

const EMPTY: UsageStats = {
  today: 0,
  d7: 0,
  d30: 0,
  daily: [],
  byPlatform: [],
  byFaculty: [],
  day: null,
};

const toDaily = (d: z.infer<typeof DayShape>): DailyUsage => ({
  day: d.day,
  active: d.active,
  newDevices: d.new,
  returningDevices: d.returning,
});

/**
 * Admin-only aggregate read: counts of DEVICES, never people. Two devices is
 * two, always — see docs/superpowers/specs/2026-09-15-admin-usage-stats-design.md.
 *
 * -1 means "under 5" (the RPC's own suppression floor) and is passed through
 * as-is — never clamped or renamed — so the UI can render it as "< 5".
 */
export async function fetchUsageStats(days: number, day?: string): Promise<UsageStats | null> {
  if (DEV_SOCIETY) return EMPTY;
  // p_day has a default in the RPC; sending an explicit null would be a third
  // argument shape for PostgREST to dispatch on for no gain.
  const args = day ? { p_days: days, p_day: day } : { p_days: days };
  const { data, error } = await adminAuthClient.rpc('usage_stats', args);
  if (error) {
    logError('Api.fetchUsageStats', error);
    return null;
  }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchUsageStats', new Error('malformed usage_stats'));
    return null;
  }
  const d = parsed.data;
  return {
    today: d.today,
    d7: d.d7,
    d30: d.d30,
    daily: d.daily.map(toDaily),
    byPlatform: d.by_platform,
    byFaculty: d.by_faculty,
    day: d.day ? { ...toDaily(d.day), byPlatform: d.day.by_platform } : null,
  };
}
