import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

/**
 * Mutes and un-mutes an IS notice for every student. Runs under the admin
 * session; RLS lets only reis_admin write. What goes up is the notice's key and
 * title as the ADMIN's own IS shows them — never a student's.
 *
 * In dev:web the seeded session cannot satisfy RLS, so writes stay in memory
 * (the same rule societyPosts and suggestionsAdmin follow).
 */
const devMutes = new Map<string, string>();

export async function muteIsNotice(key: string, title: string): Promise<boolean> {
  if (DEV_SOCIETY) {
    devMutes.set(key, title);
    return true;
  }
  const { error } = await adminAuthClient
    .from('is_notice_mutes')
    .upsert({ notice_key: key, title }, { onConflict: 'notice_key' });
  if (error) logError('Api.muteIsNotice', error);
  return !error;
}

export async function unmuteIsNotice(key: string): Promise<boolean> {
  if (DEV_SOCIETY) {
    devMutes.delete(key);
    return true;
  }
  // RLS turns a refused DELETE into zero rows, not an error: ask for the
  // deleted key back, or a failed un-mute reads as done and the notice stays
  // hidden for everyone while the console shows it un-muted.
  const { data, error } = await adminAuthClient
    .from('is_notice_mutes')
    .delete()
    .eq('notice_key', key)
    .select('notice_key');
  if (error) logError('Api.unmuteIsNotice', error);
  return !error && Array.isArray(data) && data.length > 0;
}
