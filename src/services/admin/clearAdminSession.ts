import { adminAuthClient, ADMIN_AUTH_STORAGE_KEY } from './authClient';
import { chromeStorageAdapter } from './chromeStorageAdapter';
import { logError } from '../../utils/reportError';

/**
 * Drops the society/admin login as part of signing out of reIS.
 *
 * This is a second credential and it is not in IndexedDB: supabase-js keeps
 * the session in `chrome.storage.local`, so every `clearAll()` in the
 * sign-out path went straight past it. Left behind on a shared browser, the
 * next student inherits the previous one's society admin console.
 *
 * The explicit `removeItem` is not redundant with `signOut()`. supabase-js
 * returns early WITHOUT clearing the stored session when reading the current
 * session fails (`GoTrueClient._signOut`), and a rejection would skip the
 * clearing entirely — so the storage removal is what actually guarantees the
 * credential is gone.
 *
 * Never rejects: a society session that will not clear must not take the
 * student's own sign-out down with it.
 *
 * `signOut()` talks to Supabase to revoke the refresh token, and the student's
 * own sign-out is waiting behind it — so it is given a bounded wait. The
 * storage removal happens after that wait either way, which is why the cap
 * cannot cost the guarantee: the worst case is a token that stays valid
 * server-side until it expires, on a device that no longer holds it.
 */
export async function clearAdminSession(revokeWaitMs = 2500): Promise<void> {
  try {
    await Promise.race([
      adminAuthClient.auth.signOut(),
      new Promise((resolve) => setTimeout(resolve, revokeWaitMs)),
    ]);
  } catch (e) {
    logError('Admin.signOutOnLogout', e);
  }
  try {
    await chromeStorageAdapter.removeItem(ADMIN_AUTH_STORAGE_KEY);
  } catch (e) {
    logError('Admin.removeStoredSession', e);
  }
}
