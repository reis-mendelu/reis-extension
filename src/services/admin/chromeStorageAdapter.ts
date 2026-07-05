/**
 * supabase-js session storage backed by chrome.storage.local (iframe-accessible,
 * survives reloads). Replaces the default localStorage store, which the project
 * bans (Iron Rule). supabase-js awaits these, so async is fine.
 */
export const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    // Real chrome.storage.local.get() always resolves an object (never
    // undefined), even for a missing key — but bare `vi.fn()` test mocks
    // without an implementation resolve `undefined`. Guard defensively so an
    // unrelated test file that never configured the chrome mock doesn't crash
    // supabase-js's background session load (see authClient.ts).
    const res = (await chrome.storage.local.get(key)) ?? {};
    return (res[key] as string | undefined) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};
