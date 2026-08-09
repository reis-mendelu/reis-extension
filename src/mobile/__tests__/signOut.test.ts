import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signOutMobile, type SignOutDeps } from '../signOut';

function makeDeps(over: Partial<SignOutDeps> = {}): SignOutDeps {
  return {
    clearToken: vi.fn(async () => {}),
    clearIsCookies: vi.fn(async () => {}),
    clearUserParams: vi.fn(),
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
   * The cookie is not a nice-to-have on the way out, it is the half that can
   * un-do the sign-out: `ensureSession` detects a completed login by POLLING
   * THE COOKIE JAR, so a surviving UISAuth means the next login WebView is
   * answered with the dashboard, the poll reads the cookie straight back, and
   * the student is silently returned to the same account without typing
   * anything.
   *
   * So a failure here is a FAILED sign-out, not a partial one. It must reach
   * the caller — which shows the error toast — rather than restart into a login
   * that will hand the account back.
   */
  it('fails the sign-out when the cookie jar cannot be cleared', async () => {
    const deps = makeDeps({
      clearIsCookies: vi.fn(async () => {
        throw new Error('no plugin');
      }),
    });

    await expect(signOutMobile(deps)).rejects.toThrow('no plugin');
    expect(deps.restart).not.toHaveBeenCalled();
  });

  /**
   * And it must fail BEFORE the destructive half. Wiping the student's cached
   * grades and schedule while leaving the device able to act as them is the
   * worst of both outcomes.
   */
  it('does not wipe local data when the cookie clear failed', async () => {
    const deps = makeDeps({
      clearIsCookies: vi.fn(async () => {
        throw new Error('no plugin');
      }),
    });

    await expect(signOutMobile(deps)).rejects.toThrow();
    expect(deps.clearLocalData).not.toHaveBeenCalled();
    expect(deps.clearUserParams).not.toHaveBeenCalled();
  });
});
