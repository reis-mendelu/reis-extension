import { __resetPlatformForTests, setPlatform } from '../../../platform';
import type { ReisPlatform } from '../../../platform/types';

/** In-memory Capacitor-shaped platform for unit tests. */
export function installTestPlatform(): Map<string, unknown> {
  __resetPlatformForTests();
  const mem = new Map<string, unknown>();
  const storage = {
    get: async (k: string) => mem.get(k) ?? null,
    set: async (k: string, v: unknown) => void mem.set(k, structuredClone(v)),
    remove: async (k: string) => void mem.delete(k),
  };
  setPlatform({
    kind: 'capacitor',
    storage,
    secureStorage: storage,
    getAssetUrl: (x: string) => x,
  } as unknown as ReisPlatform);
  return mem;
}
