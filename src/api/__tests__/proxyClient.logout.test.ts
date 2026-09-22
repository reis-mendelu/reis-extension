import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logout } from '../proxyClient';
import { setPlatform, __resetPlatformForTests } from '../../platform';
import type { ReisPlatform } from '../../platform/types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';

// The real sequence (token → cookies → local data → restart) is covered by
// src/mobile/__tests__/signOut.test.ts. Mocked here so this file stays about
// which path `logout()` takes, and so `restart()` doesn't try to reload the
// test environment.
const signOutMobile = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../mobile/signOut', () => ({
  signOutMobile,
  buildSignOutDeps: () => ({}),
}));

const clearAdminSession = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../services/admin/clearAdminSession', () => ({
  clearAdminSession: () => clearAdminSession(),
}));

function stub(kind: ReisPlatform['kind']): ReisPlatform {
  const bag = new Map<string, unknown>();
  return {
    kind,
    storage: {
      async get(k) {
        return bag.get(k);
      },
      async set(k, v) {
        bag.set(k, v);
      },
      async remove(k) {
        bag.delete(k);
      },
    },
    // Shares the plain bag: these tests exercise the transport, not the
    // storage guarantee — tokenStore.test.ts owns that.
    secureStorage: {
      async get(k) {
        return bag.get(k);
      },
      async set(k, v) {
        bag.set(k, v);
      },
      async remove(k) {
        bag.delete(k);
      },
    },
    getAssetUrl: (p) => `/${p}`,
  };
}

describe('logout on Capacitor', () => {
  let clearAll: ReturnType<typeof vi.spyOn>;
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAll = vi.spyOn(IndexedDBService, 'clearAll').mockResolvedValue(undefined);
    postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    signOutMobile.mockClear();
    clearAdminSession.mockClear().mockResolvedValue(undefined);
  });
  afterEach(() => {
    clearAll.mockRestore();
    postMessage.mockRestore();
    __resetPlatformForTests();
  });

  it('hands the app’s sign-out to the mobile path, not to a REIS_ACTION', async () => {
    // The app has no content script to answer a REIS_ACTION and no host page
    // holding IS's logout form, so this used to reject outright and the
    // settings row could never work. What signs the device out is removing the
    // stored token and the cookie jar — mobile/signOut owns that sequence, and
    // its own tests own the ordering guarantees.
    setPlatform(stub('capacitor'));
    await logout();

    expect(signOutMobile).toHaveBeenCalledTimes(1);
    // The destructive step belongs to signOutMobile, which only reaches it once
    // the credential is gone. Doing it here as well would wipe the data even in
    // the case that module deliberately bails out of.
    expect(clearAll).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  /**
   * The society sign-out belongs to signOutMobile on this platform, exactly
   * like the data wipe above: that module refuses to tear anything down when
   * the credential itself could not be cleared, and doing it here as well
   * would sign the student out of their society console in precisely the case
   * it deliberately bails out of.
   */
  it('leaves the society sign-out to the mobile path', async () => {
    setPlatform(stub('capacitor'));
    await logout();
    expect(clearAdminSession).not.toHaveBeenCalled();
  });

  it('propagates a failed mobile sign-out so the student is told', async () => {
    setPlatform(stub('capacitor'));
    signOutMobile.mockRejectedValueOnce(new Error('keystore unavailable'));
    await expect(logout()).rejects.toThrow(/keystore/i);
  });

  /**
   * A society login is a second credential, and it lives in
   * chrome.storage.local rather than IndexedDB — so no `clearAll()` here has
   * ever removed it, and on a shared browser the next student inherited the
   * previous one's society admin console.
   *
   * After the student's own wipe and before `executeAction('logout')`, which
   * navigates the host page away: work merely started at that point does not
   * finish, and the student's own data must not wait behind a network call.
   */
  it('still clears and dispatches on the extension, society session included', async () => {
    const order: string[] = [];
    clearAll.mockImplementation(async () => void order.push('data'));
    clearAdminSession.mockImplementation(async () => void order.push('society'));
    postMessage.mockImplementation(() => void order.push('action'));

    setPlatform(stub('extension'));
    void logout().catch(() => {});
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(order).toEqual(['data', 'society', 'action']);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const msg = postMessage.mock.calls[0]?.[0] as { type: string; action: string };
    expect(msg.type).toBe('REIS_ACTION');
    expect(msg.action).toBe('logout');
  });
});
