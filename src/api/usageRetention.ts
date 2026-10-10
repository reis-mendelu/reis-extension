import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

const Schema = z.object({
  regulars_ever: z.number(),
  gone_quiet: z.number(),
});

/** Counts of DEVICES, never people. */
export interface UsageRetention {
  /** Devices active on 2+ days of at least one week. */
  regularsEver: number;
  /** Of those, the ones that have not opened reIS for 14+ days. */
  goneQuiet: number;
}

/**
 * Admin-only aggregate read: how many of our regulars we have lost.
 * Definitions live in supabase/migrations/20261008120000_usage_retention.sql.
 */
export async function fetchUsageRetention(): Promise<UsageRetention | null> {
  if (DEV_SOCIETY) return null;
  const { data, error } = await adminAuthClient.rpc('usage_retention');
  if (error) {
    logError('Api.fetchUsageRetention', error);
    return null;
  }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchUsageRetention', new Error('malformed usage_retention'));
    return null;
  }
  return { regularsEver: parsed.data.regulars_ever, goneQuiet: parsed.data.gone_quiet };
}
