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

  it('still signs out when the cookie jar cannot be cleared', async () => {
    const deps = makeDeps({
      clearIsCookies: vi.fn(async () => {
        throw new Error('no plugin');
      }),
    });

    await signOutMobile(deps);
    expect(deps.clearLocalData).toHaveBeenCalled();
    expect(deps.restart).toHaveBeenCalled();
  });
});
