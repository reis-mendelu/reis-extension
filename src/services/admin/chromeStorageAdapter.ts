/**
 * supabase-js session storage backed by chrome.storage.local (iframe-accessible,
 * survives reloads). Replaces the default localStorage store, which the project
 * bans (Iron Rule). supabase-js awaits these, so async is fine.
 */
export const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const res = await chrome.storage.local.get(key);
    return (res[key] as string | undefined) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};
