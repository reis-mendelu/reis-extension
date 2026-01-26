export const LocalSyncStorage = {
    get<T>(key: string): T | null {
        try { const item = localStorage.getItem(key); return item === null ? null : JSON.parse(item) as T; } catch { return null; }
    },
    set<T>(key: string, val: T): void {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { if (e instanceof DOMException && e.name === 'QuotaExceededError') console.warn('Quota exceeded'); }
    },
    remove(key: string): void { try { localStorage.removeItem(key); } catch {} },
    getKeys(prefix: string): string[] {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(prefix)) keys.push(k); }
        return keys;
    }
};
