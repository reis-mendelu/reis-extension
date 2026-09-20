import { IndexedDBService } from './IndexedDBService';

/**
 * StorageService - Refactored to use IndexedDB 'meta' store.
 * Enforces async usage and removes localStorage dependency.
 */
export const StorageService = {
    // Deprecated sync methods - throwing to catch legacy usage
    get<T>(_key: string): T | null {
        throw new Error('StorageService.get is deprecated. Use getAsync.');
    },
    set(_key: string, _value?: unknown): void {
        throw new Error('StorageService.set is deprecated. Use setAsync.');
    },
    remove(_key: string): void {
        throw new Error('StorageService.remove is deprecated. Use removeAsync.');
    },
    getKeysWithPrefix(_prefix: string): string[] {
         return [];
    },
    clearAll() {
        IndexedDBService.clear('meta').catch(() => {});
    },
    
    async getAsync<T>(key: string): Promise<T | null> {
        return (await IndexedDBService.get('meta', key)) as T || null;
    },
    async setAsync<T>(key: string, val: T): Promise<void> {
        await IndexedDBService.set('meta', key, val);
    },
    async removeAsync(key: string): Promise<void> {
        await IndexedDBService.delete('meta', key);
    },

    // Cross-device sync (chrome.storage.sync)
    sync: {
        async get<T>(key: string): Promise<T | null> {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage?.sync) return null;
                const res = await chrome.storage.sync.get(key);
                return (res[key] as T) ?? null;
            } catch {
                return null;
            }
        },
        async set<T>(key: string, val: T): Promise<void> {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;
                await chrome.storage.sync.set({ [key]: val });
            } catch { /* sync set failed */ }
        },
        async remove(key: string): Promise<void> {
            try {
                if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;
                await chrome.storage.sync.remove(key);
            } catch { /* sync remove failed */ }
        }
    }
};
