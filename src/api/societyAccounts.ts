import { adminAuthClient } from '../services/admin/authClient';
import { logError } from '../utils/reportError';

export interface SocietyAccountRow {
  association_id: string;
  association_name: string;
  is_active: boolean;
}

export async function listSocietyAccounts(): Promise<SocietyAccountRow[]> {
  const { data, error } = await adminAuthClient
    .from('spolky_accounts')
    .select('association_id, association_name, is_active')
    .order('association_name');
  if (error) {
    logError('Api.listSocietyAccounts', error);
    return [];
  }
  return (data ?? []) as SocietyAccountRow[];
}

/**
 * Returns the generated password ONCE. It is never stored, never logged and
 * never sent anywhere else — the caller shows it and drops it. Deliberately not
 * passed to logError either, which would put it in a telemetry payload.
 */
export async function resetSocietyPassword(
  username: string
): Promise<{ password?: string; error?: string }> {
  const { data, error } = await adminAuthClient.functions.invoke('society-accounts', {
    body: { action: 'reset', username },
  });
  if (error) {
    logError('Api.resetSocietyPassword', error);
    return { error: 'reset_failed' };
  }
  if (data?.error) return { error: String(data.error) };
  if (!data?.password) return { error: 'reset_failed' };
  return { password: data.password };
}

/**
 * Creates the auth user and the account row in one server-side call, so the two
 * cannot diverge. Returns the generated password ONCE, under the same rules as
 * resetSocietyPassword.
 */
export async function createSocietyAccount(
  username: string,
  associationName: string
): Promise<{ password?: string; error?: string }> {
  const { data, error } = await adminAuthClient.functions.invoke('society-accounts', {
    body: { action: 'create', username, associationName },
  });
  if (error) {
    logError('Api.createSocietyAccount', error);
    return { error: 'create_failed' };
  }
  if (data?.error) return { error: String(data.error) };
  if (!data?.password) return { error: 'create_failed' };
  return { password: data.password };
}
