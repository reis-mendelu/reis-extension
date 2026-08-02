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

  it('throws a useful error when nothing was installed', () => {
    __resetPlatformForTests();
    expect(() => getPlatform()).toThrow(/no platform installed/i);
  });

  it('round-trips storage through the installed platform', async () => {
    setPlatform(stub('extension'));
    await getPlatform().storage.set('theme', 'dark');
    expect(await getPlatform().storage.get('theme')).toBe('dark');
    await getPlatform().storage.remove('theme');
    expect(await getPlatform().storage.get('theme')).toBeUndefined();
  });
});
