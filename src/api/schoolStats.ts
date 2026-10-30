import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';
import type { UsageGroup } from './usageStats';

const Group = z.object({ key: z.string(), n: z.number() });

const Schema = z.object({
  week_from: z.string(),
  week_to: z.string(),
  regulars: z.number(),
  regulars_phone: z.number(),
  regulars_by_faculty: z.array(Group),
  eduroam_since: z.string().nullable(),
  eduroam_total: z.number(),
  eduroam_wifi: z.number(),
  eduroam_profile: z.number(),
  eduroam_by_faculty: z.array(Group),
  eduroam_by_week: z.array(Group),
  events: z.object({
    posts: z.number(),
    views: z.number(),
    clicks: z.number(),
    map_views: z.number(),
  }),
  notices: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      starts_at: z.string(),
      ends_at: z.string(),
      seen: z.number(),
    })
  ),
});

/**
 * What reIS can show MENDELU, all from data it already collects. Counts of
 * INSTALLS, never people; -1 means "under 10", this card's floor (stricter than
 * the console's 5, because the card is meant to leave reIS).
 */
export interface SchoolStats {
  /** The last complete Monday–Sunday week the regulars describe. */
  weekFrom: string;
  weekTo: string;
  /** Installs IS has named a student on, active on 2+ days of that week. */
  regulars: number;
  regularsPhone: number;
  regularsByFaculty: UsageGroup[];
  /** The first day the eduroam counter recorded anything; null before then. */
  eduroamSince: string | null;
  /** Installs with any eduroam setup, suppressed on its own (not a sum of two hidden counts). */
  eduroamTotal: number;
  eduroamWifi: number;
  eduroamProfile: number;
  eduroamByFaculty: UsageGroup[];
  /** Keyed by the Monday of each week. */
  eduroamByWeek: UsageGroup[];
  events: { posts: number; views: number; clicks: number; mapViews: number };
  notices: { id: string; prompt: string; startsAt: string; endsAt: string; seen: number }[];
}

const groups = (g: z.infer<typeof Group>[]): UsageGroup[] =>
  g.map(({ key, n }) => ({ key, devices: n }));

/** Admin-only aggregate read, defined in supabase/migrations/20261030120000_school_stats.sql. */
export async function fetchSchoolStats(): Promise<SchoolStats | null> {
  if (DEV_SOCIETY) return null;
  const { data, error } = await adminAuthClient.rpc('school_stats');
  if (error) {
    logError('Api.fetchSchoolStats', error);
    return null;
  }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchSchoolStats', new Error('malformed school_stats'));
    return null;
  }
  const d = parsed.data;
  return {
    weekFrom: d.week_from,
    weekTo: d.week_to,
    regulars: d.regulars,
    regularsPhone: d.regulars_phone,
    regularsByFaculty: groups(d.regulars_by_faculty),
    eduroamSince: d.eduroam_since,
    eduroamTotal: d.eduroam_total,
    eduroamWifi: d.eduroam_wifi,
    eduroamProfile: d.eduroam_profile,
    eduroamByFaculty: groups(d.eduroam_by_faculty),
    eduroamByWeek: groups(d.eduroam_by_week),
    events: {
      posts: d.events.posts,
      views: d.events.views,
      clicks: d.events.clicks,
      mapViews: d.events.map_views,
    },
    notices: d.notices.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      startsAt: q.starts_at,
      endsAt: q.ends_at,
      seen: q.seen,
    })),
  };
}
