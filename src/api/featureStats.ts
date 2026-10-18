import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

const FeatureRow = z.object({
  feature: z.string(),
  installs: z.number(),
  hits: z.number(),
});
const EventRow = z.object({
  id: z.string(),
  title: z.string(),
  map_views: z.number(),
});
const DailyRow = z.object({
  day: z.string(),
  feature: z.string(),
  installs: z.number(),
});
const EventDailyRow = z.object({
  day: z.string(),
  event_id: z.string(),
  views: z.number(),
});
const ReachRow = z.object({
  id: z.string(),
  title: z.string(),
  association_id: z.string(),
  kind: z.string(),
  view_count: z.number(),
  click_count: z.number(),
  map_views: z.number(),
});
const Schema = z.object({
  by_feature: z.array(FeatureRow),
  daily: z.array(DailyRow),
  top_events: z.array(EventRow),
  event_daily: z.array(EventDailyRow),
  // Added by 20261018120000_feature_stats_event_reach.sql, which lands at
  // release, not on merge. A database without it answers without the key, and
  // that must not take the whole feature block down with it.
  event_reach: z.array(ReachRow).optional().default([]),
});

export interface FeatureSignalCount {
  /** One of the three labels written by `api/featureUsage.ts`. */
  feature: string;
  /** -1 means "under 5" — the RPC's suppression floor. Never clamp it. */
  installs: number;
  /** Total occurrences. -1 whenever `installs` is suppressed. */
  hits: number;
}

export interface EventMapViews {
  id: string;
  title: string;
  mapViews: number;
}

/**
 * One post as both surfaces saw it. `views`/`clicks` are the Novinky counters
 * on the row (views once per DEVICE, clicks every tap) and `mapViews` is every
 * map open summed over ALL days — all three since publication, so they can sit
 * side by side. Counts of opens: nothing here says which install did which.
 */
export interface EventReach {
  id: string;
  title: string;
  societyId: string;
  /** 'event' has a pin on the map; 'notice' is Novinky only. */
  kind: string;
  views: number;
  clicks: number;
  mapViews: number;
}

/** One day of one signal. Absent entirely for a signal under the floor. */
export interface FeatureDailyPoint {
  day: string;
  feature: string;
  installs: number;
}

/** One day of one event's map opens. */
export interface EventDailyPoint {
  day: string;
  eventId: string;
  views: number;
}

export interface FeatureStats {
  byFeature: FeatureSignalCount[];
  /**
   * Daily installs per signal, for signals whose window total cleared the
   * suppression floor. A signal reporting -1 above has NO rows here — its
   * shape is withheld along with its total, rather than published a day at a
   * time. Sparse: a day with no activity has no row, which is why every reader
   * goes through `utils/trendSeries`.
   */
  daily: FeatureDailyPoint[];
  /** The ten most-opened events on the map within the window, most first. */
  topEvents: EventMapViews[];
  /** Daily opens for those ten events. Sparse, like `daily`. */
  eventDaily: EventDailyPoint[];
  /** Every post with any activity, Novinky and map side by side. */
  eventReach: EventReach[];
}

const EMPTY: FeatureStats = {
  byFeature: [],
  daily: [],
  topEvents: [],
  eventDaily: [],
  eventReach: [],
};

/**
 * Admin-only aggregate read for the three feature signals and the per-event map
 * views beside them.
 *
 * Counts of INSTALLS, never people — the same caveat the usage panel carries,
 * for the same reason: the identifier behind these numbers belongs to an
 * installation. `map_views` is a count of OPENS within the window, with no
 * identifier behind it at all, deduplicated only per app session on the device.
 *
 * -1 means "under 5" and is passed through as-is so the UI can render it as
 * "< 5" rather than a number a small group could be narrowed from.
 */
export async function fetchFeatureStats(days: number): Promise<FeatureStats | null> {
  if (DEV_SOCIETY) return EMPTY;
  const { data, error } = await adminAuthClient.rpc('feature_stats', { p_days: days });
  if (error) {
    logError('Api.fetchFeatureStats', error);
    return null;
  }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchFeatureStats', new Error('malformed feature_stats'));
    return null;
  }
  return {
    byFeature: parsed.data.by_feature,
    daily: parsed.data.daily,
    topEvents: parsed.data.top_events.map((e) => ({
      id: e.id,
      title: e.title,
      mapViews: e.map_views,
    })),
    eventDaily: parsed.data.event_daily.map((d) => ({
      day: d.day,
      eventId: d.event_id,
      views: d.views,
    })),
    eventReach: parsed.data.event_reach.map((e) => ({
      id: e.id,
      title: e.title,
      societyId: e.association_id,
      kind: e.kind,
      views: e.view_count,
      clicks: e.click_count,
      mapViews: e.map_views,
    })),
  };
}
