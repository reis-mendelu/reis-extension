import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

const FeatureRow = z.object({
  feature: z.string(),
  installs: z.number(),
  hits: z.number(),
});
const DailyRow = z.object({
  day: z.string(),
  feature: z.string(),
  installs: z.number(),
});
const Schema = z.object({
  by_feature: z.array(FeatureRow),
  daily: z.array(DailyRow),
});

export interface FeatureSignalCount {
  /** One of the three labels written by `api/featureUsage.ts`. */
  feature: string;
  /** -1 means "under 5" — the RPC's suppression floor. Never clamp it. */
  installs: number;
  /** Total occurrences. -1 whenever `installs` is suppressed. */
  hits: number;
}

/** One day of one signal. Absent entirely for a signal under the floor. */
export interface FeatureDailyPoint {
  day: string;
  feature: string;
  installs: number;
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
}

const EMPTY: FeatureStats = { byFeature: [], daily: [] };

/**
 * Admin-only aggregate read for the three feature signals. (The RPC also
 * returns per-event map views; those are read per event now, in the event
 * list — api/eventSignalsAdmin — and ignored here.)
 *
 * Counts of INSTALLS, never people — the same caveat the usage panel carries,
 * for the same reason: the identifier behind these numbers belongs to an
 * installation.
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
  };
}
