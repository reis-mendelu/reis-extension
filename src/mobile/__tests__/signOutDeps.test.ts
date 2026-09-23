import { describe, it, expect, vi, beforeEach } from 'vitest';

const inAppClear = vi.fn();
const capClear = vi.fn();
vi.mock('@capgo/capacitor-inappbrowser', () => ({
  InAppBrowser: { clearCookies: inAppClear },
}));
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  CapacitorCookies: { clearCookies: capClear },
}));

import { buildSignOutDeps } from '../signOut';

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
