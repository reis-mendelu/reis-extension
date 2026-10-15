import { describe, it, expect, vi, beforeEach } from 'vitest';

const capClear = vi.fn(async (_o: { url: string }) => {});
const capClearAll = vi.fn(async () => {});
const inAppClear = vi.fn(async (_o: { url: string }) => {});
let platform = 'android';
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => platform },
  CapacitorCookies: { clearCookies: capClear, clearAllCookies: capClearAll },
}));
vi.mock('@capgo/capacitor-inappbrowser', () => ({ InAppBrowser: { clearCookies: inAppClear } }));
const clearJar = vi.fn(async () => true);
vi.mock('../iskamCookieStore', () => ({ clearJar: () => clearJar() }));
vi.mock('../iskamStore', () => ({ useIskamStore: { getState: () => ({ signOut: vi.fn() }) } }));

import { clearIskam } from '../clearIskam';

describe('clearIskam', () => {
  beforeEach(() => vi.clearAllMocks());

  // Review finding I2: on Android Capacitor's own CookieHandler copies every
  // native response cookie into the WebView jar — under the request URL AND
  // the app's own origin — so clearing the two WebISKAM URLs left copies.
  it('Android: empties the whole WebView cookie jar, not just the two WebISKAM URLs', async () => {
    platform = 'android';
    await clearIskam();
    expect(clearJar).toHaveBeenCalled();
    expect(capClearAll).toHaveBeenCalled();
  });

  it('still clears the native jars when the secure store refuses (review M4)', async () => {
    clearJar.mockRejectedValueOnce(new Error('keystore'));
    await expect(clearIskam()).rejects.toThrow('keystore');
    expect(capClear).toHaveBeenCalled();
  });

  // PR #548 review (CodeRabbit): a native jar that could not be cleared is a
  // failed sign-out step, reported, not a quiet success.
  it('reports Android failing to empty the WebView jar', async () => {
    platform = 'android';
    capClearAll.mockRejectedValueOnce(new Error('no cookie manager'));
    await expect(clearIskam()).rejects.toThrow('no cookie manager');
  });

  it('reports a WebISKAM URL that neither store could clear', async () => {
    platform = 'ios';
    capClear.mockRejectedValue(new Error('cap'));
    inAppClear.mockRejectedValue(new Error('inapp'));
    await expect(clearIskam()).rejects.toThrow();
    capClear.mockReset();
    inAppClear.mockReset();
  });
});
