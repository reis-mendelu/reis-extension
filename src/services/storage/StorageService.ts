import { IndexedDBService } from './IndexedDBService';

/**
 * StorageService - Refactored to use IndexedDB 'meta' store.
 * Enforces async usage and removes localStorage dependency.
 */
export const StorageService = {
    // Deprecated sync methods - throwing to catch legacy usage
    get<T>(key: string): T | null {
        console.error(`[StorageService] Synchronous get('${key}') is deprecated and unsafe. Use getAsync instead.`);
        throw new Error('StorageService.get is deprecated. Use getAsync.');
    },
    set<T>(key: string, val: T): void {
        console.error(`[StorageService] Synchronous set('${key}') is deprecated. Use setAsync instead.`);
        throw new Error('StorageService.set is deprecated. Use setAsync.');
    },
    remove(key: string): void {
        console.error(`[StorageService] Synchronous remove('${key}') is deprecated. Use removeAsync instead.`);
        throw new Error('StorageService.remove is deprecated. Use removeAsync.');
    },
    getKeysWithPrefix(prefix: string): string[] {
         console.warn(`[StorageService] getKeysWithPrefix('${prefix}') is simplified/deprecated.`);
         return []; 
    },
    clearAll() { 
        console.warn('[StorageService] clearAll() called - clearing meta store');
        IndexedDBService.clear('meta').catch(e => console.error(e));
    },
    
    async getAsync<T>(key: string): Promise<T | null> {
        return (await IndexedDBService.get('meta', key)) as T || null;
    },
    async setAsync<T>(key: string, val: T): Promise<void> {
        await IndexedDBService.set('meta', key, val);
    },
    async removeAsync(key: string): Promise<void> {
        await IndexedDBService.delete('meta', key);
    }
};
