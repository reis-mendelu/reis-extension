import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signOutMobile, type SignOutDeps } from '../signOut';

function makeDeps(over: Partial<SignOutDeps> = {}): SignOutDeps {
  return {
    clearToken: vi.fn(async () => {}),
    clearIsCookies: vi.fn(async () => {}),
    clearUserParams: vi.fn(),
    clearAdminSession: vi.fn(async () => {}),
    clearLocalData: vi.fn(async () => {}),
    restart: vi.fn(),
    ...over,
  };
}

describe('signOutMobile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears the stored token, the IS cookies and the local data, then restarts', async () => {
    const deps = makeDeps();
    await signOutMobile(deps);

    expect(deps.clearToken).toHaveBeenCalled();
    expect(deps.clearIsCookies).toHaveBeenCalled();
    expect(deps.clearUserParams).toHaveBeenCalled();
    expect(deps.clearLocalData).toHaveBeenCalled();
    expect(deps.restart).toHaveBeenCalled();
  });

  /**
   * The society/admin login is a second credential and supabase-js keeps it
   * outside IndexedDB, so no wipe here reaches it. On a shared handset that
   * means the next student inherits the previous one's admin console.
   */
  it('drops the society session too', async () => {
    const deps = makeDeps();
    await signOutMobile(deps);
    expect(deps.clearAdminSession).toHaveBeenCalled();
  });

  /**
   * And not when the sign-out is refused. Signed in as the student but signed
   * out of their society console is precisely the half-torn-down state the
   * refusal above exists to prevent.
   */
  it('leaves the society session alone when the sign-out is refused', async () => {
    const deps = makeDeps({
      clearToken: vi.fn(async () => {
        throw new Error('keystore unavailable');
      }),
    });
    await expect(signOutMobile(deps)).rejects.toThrow();
    expect(deps.clearAdminSession).not.toHaveBeenCalled();
  });

  it('clears the cookies as well as the token', async () => {
    // The token alone is not the session. The login WebView shares the app's
    // cookie jar, so with UISAuth still in it IS answers the next "log in"
    // with the dashboard and ensureSession reads the cookie straight back —
    // the student taps sign out, gets shown a login, and is silently signed
    // back into the SAME account without typing anything.
    const order: string[] = [];
    const deps = makeDeps({
      clearToken: vi.fn(async () => {
        order.push('token');
      }),
      clearIsCookies: vi.fn(async () => {
        order.push('cookies');
      }),
      restart: vi.fn(() => {
        order.push('restart');
      }),
    });

    await signOutMobile(deps);
    expect(order).toEqual(['token', 'cookies', 'restart']);
  });

  it('refuses to wipe local data when the credential itself could not be cleared', async () => {
    // Same rule the desktop path already follows: the destructive half must
    // not run when the sign-out cannot. Wiping first would leave the student
    // with an emptied app AND a device that can still act as them.
    const deps = makeDeps({
      clearToken: vi.fn(async () => {
        throw new Error('keystore unavailable');
      }),
    });

    await expect(signOutMobile(deps)).rejects.toThrow('keystore unavailable');
    expect(deps.clearLocalData).not.toHaveBeenCalled();
    expect(deps.restart).not.toHaveBeenCalled();
  });

  it('still signs out when clearing the local data fails', async () => {
    // The credential is already gone by this point, so the sign-out has
    // succeeded in the sense that matters. A failed IndexedDB clear must not
    // strand the student in a half-signed-out app — the restart puts them at
    // the login, which gates the data anyway.
    const deps = makeDeps({
      clearLocalData: vi.fn(async () => {
        throw new Error('idb blocked');
      }),
    });

    await signOutMobile(deps);
    expect(deps.restart).toHaveBeenCalled();
  });

  /**
   * The cookie clear reports failure on exactly the devices it matters least
   * to: `InAppBrowser.clearCookies` only reaches an OPEN browser dialog on
   * Android (and on iOS below 17), and the login WebView closed long before
   * the student taps "Sign out". So on those devices it rejected every time.
   *
   * By then the token is already gone, so a rejection here does not refuse
   * anything. Letting it escape skipped the wipe, the society sign-out and the
   * restart, and showed the error toast over an app that was in fact signed
   * out, until the student restarted it by hand.
   *
   * The cookie still cannot be allowed to hand the account back. That is now
   * enforced where it matters, when the login opens (`clearCookiesOnOpen`).
   */
  it('still wipes and restarts when the cookie clear rejects', async () => {
    const deps = makeDeps({
      clearIsCookies: vi.fn(async () => {
        throw new Error('WebView is not initialized');
      }),
    });

    await signOutMobile(deps);
    expect(deps.clearUserParams).toHaveBeenCalled();
    expect(deps.clearAdminSession).toHaveBeenCalled();
    expect(deps.clearLocalData).toHaveBeenCalled();
    expect(deps.restart).toHaveBeenCalled();
  });
});
