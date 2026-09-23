import { describe, it, expect, vi, beforeEach } from 'vitest';

const signOut = vi.fn(async () => ({ error: null }));
const removeItem = vi.fn(async (_key: string) => {});

vi.mock('../authClient', () => ({
  adminAuthClient: { auth: { signOut: () => signOut() } },
  ADMIN_AUTH_STORAGE_KEY: 'reis_admin_auth',
}));
vi.mock('../chromeStorageAdapter', () => ({
  chromeStorageAdapter: { removeItem: (k: string) => removeItem(k) },
}));

const { clearAdminSession } = await import('../clearAdminSession');

describe('clearAdminSession', () => {
  beforeEach(() => {
    signOut.mockClear().mockResolvedValue({ error: null });
    removeItem.mockClear();
  });

  /**
   * A society login is a SECOND credential, and it does not live in
   * IndexedDB — supabase-js keeps it in chrome.storage.local, which no wipe in
   * the sign-out path has ever touched. Left behind, the next student to use
   * this browser inherits the previous one's society admin console.
   */
  it('signs the society session out and removes its stored session', async () => {
    await clearAdminSession();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith('reis_admin_auth');
  });

  /**
   * And the removal does not depend on that call working. supabase-js returns
   * early WITHOUT clearing the stored session when reading the current session
   * fails (GoTrueClient `_signOut`), and a rejection here would skip the
   * clearing altogether — either way the credential would outlive the
   * sign-out, which is the one outcome that must not happen.
   */
  it('removes the stored session even when the sign-out call fails', async () => {
    signOut.mockRejectedValue(new Error('offline'));
    await clearAdminSession();
    expect(removeItem).toHaveBeenCalledWith('reis_admin_auth');
  });

  /**
   * The student is waiting behind this call. A Supabase revoke that never
   * answers must not hold the sign-out open — and the removal still has to
   * happen after the wait runs out, because that is the half that actually
   * protects the next person to use the browser.
   */
  it('removes the stored session even when the revoke never answers', async () => {
    signOut.mockImplementation(() => new Promise(() => {}));
    await clearAdminSession(1);
    expect(removeItem).toHaveBeenCalledWith('reis_admin_auth');
  });

  // A failure to clear must not take the student's own sign-out down with it.
  it('never rejects', async () => {
    signOut.mockRejectedValue(new Error('offline'));
    removeItem.mockRejectedValue(new Error('storage gone'));
    await expect(clearAdminSession()).resolves.toBeUndefined();
  });
});
