import { describe, it, expect, beforeEach } from 'vitest';
import { getPlatform, setPlatform, __resetPlatformForTests } from '../index';
import type { ReisPlatform } from '../types';

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
    // Credentials share the same bag here: this stub exists to exercise the
    // platform resolver, not the storage guarantee, which tokenStore.test.ts owns.
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

describe('platform registry', () => {
  beforeEach(() => setPlatform(stub('web')));

  it('returns the platform that was set', () => {
    expect(getPlatform().kind).toBe('web');
    setPlatform(stub('capacitor'));
    expect(getPlatform().kind).toBe('capacitor');
  });

  it('auto-installs the extension host when a real chrome runtime is visible', () => {
    // The extension must never require a new boot step — see getPlatform().
    __resetPlatformForTests();
    expect(getPlatform().kind).toBe('extension');
  });

  it('throws when nothing is installed and there is no extension runtime', () => {
    __resetPlatformForTests();
    const g = globalThis as { chrome?: { runtime?: { id?: string } } };
    const realId = g.chrome?.runtime?.id;
    if (g.chrome?.runtime) delete g.chrome.runtime.id;
    try {
      expect(() => getPlatform()).toThrow(/no platform installed/i);
    } finally {
      if (g.chrome?.runtime) g.chrome.runtime.id = realId;
    }
  });

  it('an explicitly installed host still wins over auto-detection', () => {
    __resetPlatformForTests();
    setPlatform(stub('capacitor'));
    expect(getPlatform().kind).toBe('capacitor');
  });

  it('round-trips storage through the installed platform', async () => {
    setPlatform(stub('extension'));
    await getPlatform().storage.set('theme', 'dark');
    expect(await getPlatform().storage.get('theme')).toBe('dark');
    await getPlatform().storage.remove('theme');
    expect(await getPlatform().storage.get('theme')).toBeUndefined();
  });
});
