export const ChromeAsyncStorage = {
    available: () => typeof chrome !== 'undefined' && !!chrome.storage?.local,
    async get<T>(key: string): Promise<T | null> {
        try { const res = await chrome.storage.local.get(key); return (res[key] as T) ?? null; } catch { return null; }
    },
    async set<T>(key: string, val: T): Promise<void> {
        try { await chrome.storage.local.set({ [key]: val }); } catch (e) { console.error('[ChromeAsyncStorage] set failed:', e); }
    },
    async remove(key: string): Promise<void> {
        try { await chrome.storage.local.remove(key); } catch (e) { console.error('[ChromeAsyncStorage] remove failed:', e); }
    }
};
