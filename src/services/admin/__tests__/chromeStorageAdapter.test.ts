import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromeStorageAdapter } from '../chromeStorageAdapter';

describe('chromeStorageAdapter', () => {
  beforeEach(() => {
    const store: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: async (k: string) => ({ [k]: store[k] }),
          set: async (obj: Record<string, unknown>) => {
            Object.assign(store, obj);
          },
          remove: async (k: string) => {
            delete store[k];
          },
        },
      },
    };
  });

  it('round-trips a value', async () => {
    await chromeStorageAdapter.setItem('reis_admin_auth', 'tok');
    expect(await chromeStorageAdapter.getItem('reis_admin_auth')).toBe('tok');
  });

  it('returns null for a missing key', async () => {
    expect(await chromeStorageAdapter.getItem('nope')).toBeNull();
  });

  it('removes a value', async () => {
    await chromeStorageAdapter.setItem('k', 'v');
    await chromeStorageAdapter.removeItem('k');
    expect(await chromeStorageAdapter.getItem('k')).toBeNull();
  });
});

describe('chromeStorageAdapter without a chrome runtime (Capacitor)', () => {
  // MEASURED on an Android device: supabase-js's background auto-refresh tick
  // crashed with "ReferenceError: chrome is not defined", because there is no
  // chrome global in a Capacitor WebView at all — not even an empty one.
  // Cast through a loose record: `delete` needs optional properties, and the
  // real `chrome` global is typed as always-present.
  const g = globalThis as unknown as Record<string, unknown>;
  let savedChrome: unknown;
  let savedBrowser: unknown;

  beforeEach(async () => {
    savedChrome = g.chrome;
    savedBrowser = g.browser;
    delete g.chrome;
    delete g.browser;
    const { setPlatform } = await import('../../../platform');
    const { createWebPlatform } = await import('../../../platform/webPlatform');
    setPlatform(createWebPlatform());
  });

  afterEach(() => {
    g.chrome = savedChrome;
    g.browser = savedBrowser;
  });

  it('does not throw when chrome is undefined', async () => {
    await expect(chromeStorageAdapter.getItem('any')).resolves.toBeNull();
  });

  it('round-trips a supabase session string through the platform storage', async () => {
    await chromeStorageAdapter.setItem('reis_admin_auth', 'tok');
    expect(await chromeStorageAdapter.getItem('reis_admin_auth')).toBe('tok');
    await chromeStorageAdapter.removeItem('reis_admin_auth');
    expect(await chromeStorageAdapter.getItem('reis_admin_auth')).toBeNull();
  });
});
