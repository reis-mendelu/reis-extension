import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The sync language crosses a context boundary in the extension — the iframe
 * writes it, the content script reads it — and a host whose storage returns
 * anything but the value it was given (JSON-encoded, wrapped) would make every
 * sync silently read 'cz'. So it round-trips through each REAL host's storage.
 */
const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
  },
}));
vi.mock('../../../platform/secureStore', () => ({ capacitorSecureStorage: {} }));

import { setPlatform, __resetPlatformForTests } from '../../../platform';
import { createExtensionPlatform } from '../../../platform/extensionPlatform';
import { createCapacitorPlatform } from '../../../platform/capacitorPlatform';
import { readSyncLanguage, writeSyncLanguage } from '../syncLanguage';

describe('the sync language survives each host', () => {
  beforeEach(() => {
    prefs.clear();
    const local = new Map<string, unknown>();
    vi.stubGlobal('chrome', {
      runtime: { id: 'test' },
      storage: {
        local: {
          get: async (key: string) => (local.has(key) ? { [key]: local.get(key) } : {}),
          set: async (items: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(items)) local.set(k, v);
          },
          remove: async (key: string) => void local.delete(key),
        },
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetPlatformForTests();
  });

  it.each([
    ['extension (chrome.storage.local)', createExtensionPlatform],
    ['Capacitor (Preferences, JSON-encoded)', createCapacitorPlatform],
  ])('%s: what the app writes is what the sync reads', async (_host, create) => {
    setPlatform(create());
    expect(await readSyncLanguage(), 'nothing written yet').toBe('cz');
    await writeSyncLanguage('en');
    expect(await readSyncLanguage()).toBe('en');
    await writeSyncLanguage('cz');
    expect(await readSyncLanguage()).toBe('cz');
  });
});
