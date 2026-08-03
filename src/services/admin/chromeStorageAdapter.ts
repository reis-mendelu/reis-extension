/**
 * supabase-js session storage backed by chrome.storage.local (iframe-accessible,
 * survives reloads). Replaces the default localStorage store, which the project
 * bans (Iron Rule). supabase-js awaits these, so async is fine.
 */
/* eslint-disable no-restricted-syntax -- this adapter intentionally uses the
   storage.local KV directly: it is the string get/set/remove store that backs
   the supabase-js auth session (must survive reloads, be iframe-accessible, and
   NOT be localStorage). StorageService is a typed IDB wrapper, not a drop-in for
   supabase-js's storage contract. */
import { getPlatform } from '../../platform';

// Prefer the promise-based `browser` namespace (native on Firefox); fall back to
// `chrome` (promise-based on MV3 Chromium). Raw `chrome.*` is callback-based on
// Firefox, so awaiting it there silently no-ops and would drop the admin auth
// session on the Firefox/AMO build — this picks the promise-safe area on both
// engines without a polyfill dependency. Resolved lazily per call (not captured
// at module load) so it always reads the live global.
const storageArea = (): chrome.storage.StorageArea | null => {
  const g = globalThis as typeof globalThis & { browser?: typeof chrome };
  return (
    g.browser?.storage?.local ??
    // `typeof` guard, not `chrome?.` — in a Capacitor WebView there is no chrome
    // binding at ALL, so `chrome?.storage` still throws a ReferenceError.
    // Measured on device: supabase-js's background auto-refresh tick crashed
    // with exactly that.
    (typeof chrome !== 'undefined' ? (chrome.storage?.local ?? null) : null)
  );
};

export const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const area = storageArea();
    if (!area) return ((await getPlatform().storage.get(key)) as string | undefined) ?? null;
    // A real storage.local.get() always resolves an object (never undefined),
    // even for a missing key — but bare `vi.fn()` test mocks without an
    // implementation resolve `undefined`. Guard defensively so an unrelated test
    // file that never configured the mock doesn't crash supabase-js's background
    // session load (see authClient.ts).
    const res = (await area.get(key)) ?? {};
    return (res[key] as string | undefined) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const area = storageArea();
    if (!area) return getPlatform().storage.set(key, value);
    await area.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    const area = storageArea();
    if (!area) return getPlatform().storage.remove(key);
    await area.remove(key);
  },
};
