import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';
import type { UsageGroup } from './usageStats';

const Schema = z.array(z.object({ key: z.string(), devices: z.number() }));

/**
 * Admin-only aggregate read: DEVICES per faculty and base study programme
 * ('PEF B-OI'; 'PEF ?' = programme not sent by an older build, or not parsed).
 * -1 means "under 5" and is passed through as-is. Definitions live in
 * supabase/migrations/20261011120000_partner_targeting.sql.
 */
export async function fetchUsageProgrammes(days: number): Promise<UsageGroup[] | null> {
  if (DEV_SOCIETY) return null;
  const { data, error } = await adminAuthClient.rpc('usage_programmes', { p_days: days });
  if (error) {
    logError('Api.fetchUsageProgrammes', error);
    return null;
  }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchUsageProgrammes', new Error('malformed usage_programmes'));
    return null;
  }
  return parsed.data;
}
