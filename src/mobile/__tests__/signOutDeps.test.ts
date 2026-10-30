import { describe, it, expect, vi, beforeEach } from 'vitest';

const inAppClear = vi.fn();
const capClear = vi.fn();
vi.mock('@capgo/capacitor-inappbrowser', () => ({
  InAppBrowser: { clearCookies: inAppClear },
}));
const { clearAll, resetNewBoxes } = vi.hoisted(() => ({
  clearAll: vi.fn(),
  resetNewBoxes: vi.fn(),
}));
vi.mock('../../services/storage', () => ({ IndexedDBService: { clearAll } }));
vi.mock('../../services/sync/newSubmissionBoxes', () => ({ resetNewBoxes }));
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  CapacitorCookies: { clearCookies: capClear },
}));

import { buildSignOutDeps } from '../signOut';
import { __resetSignOutCleanupsForTests, registerSignOutCleanup } from '../signOutCleanups';

describe('buildSignOutDeps().clearIsCookies', () => {
  beforeEach(() => {
    inAppClear.mockReset();
    capClear.mockReset();
  });

  /**
   * What Android does on every sign-out: no browser dialog is open, so
   * InAppBrowser rejects, while CapacitorCookies clears the process-wide jar.
   * That is a normal sign-out, not a failure to report.
   */
  it('resolves when only CapacitorCookies can reach the jar', async () => {
    inAppClear.mockRejectedValue(new Error('WebView is not initialized'));
    capClear.mockResolvedValue(undefined);
    await expect(buildSignOutDeps().clearIsCookies()).resolves.toBeUndefined();
  });

  it('rejects only when neither jar could be cleared', async () => {
    inAppClear.mockRejectedValue(new Error('WebView is not initialized'));
    capClear.mockRejectedValue(new Error('no bridge'));
    await expect(buildSignOutDeps().clearIsCookies()).rejects.toThrow('WebView is not initialized');
  });
});

describe('buildSignOutDeps().clearOtherLogins', () => {
  it('runs what the Capacitor entry registered, and nothing when it registered nothing', async () => {
    __resetSignOutCleanupsForTests();
    await expect(buildSignOutDeps().clearOtherLogins()).resolves.toBeUndefined();
    const clearIskam = vi.fn(async () => {});
    registerSignOutCleanup(clearIskam);
    await buildSignOutDeps().clearOtherLogins();
    expect(clearIskam).toHaveBeenCalledTimes(1);
    __resetSignOutCleanupsForTests();
  });
});

// Release review (cubic): the wipe-then-reset order had no test. The reset
// runs even when the IndexedDB wipe fails, or a sync still being stored
// writes its boxes back.
describe('buildSignOutDeps().clearLocalData', () => {
  beforeEach(() => {
    clearAll.mockReset();
    resetNewBoxes.mockReset();
  });

  it('resets the new boxes even when the wipe rejects', async () => {
    clearAll.mockRejectedValue(new Error('idb blocked'));
    resetNewBoxes.mockResolvedValue(undefined);
    await expect(buildSignOutDeps().clearLocalData()).rejects.toThrow('idb blocked');
    expect(resetNewBoxes).toHaveBeenCalledTimes(1);
  });

  it('wipes first, then resets', async () => {
    const order: string[] = [];
    clearAll.mockImplementation(async () => void order.push('wipe'));
    resetNewBoxes.mockImplementation(async () => void order.push('reset'));
    await buildSignOutDeps().clearLocalData();
    expect(order).toEqual(['wipe', 'reset']);
  });
});
