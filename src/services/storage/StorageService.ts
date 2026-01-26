import { LocalSyncStorage } from './LocalSyncStorage';
import { ChromeAsyncStorage } from './ChromeAsyncStorage';

export const StorageService = {
    get: LocalSyncStorage.get,
    set: LocalSyncStorage.set,
    remove: LocalSyncStorage.remove,
    getKeysWithPrefix: LocalSyncStorage.getKeys,
    clearAll() { LocalSyncStorage.getKeys('reis_').forEach(k => LocalSyncStorage.remove(k)); },
    
    async getAsync<T>(key: string): Promise<T | null> {
        return ChromeAsyncStorage.available() ? ChromeAsyncStorage.get<T>(key) : LocalSyncStorage.get<T>(key);
    },
    async setAsync<T>(key: string, val: T): Promise<void> {
        if (ChromeAsyncStorage.available()) await ChromeAsyncStorage.set(key, val); else LocalSyncStorage.set(key, val);
    },
    async removeAsync(key: string): Promise<void> {
        if (ChromeAsyncStorage.available()) await ChromeAsyncStorage.remove(key); else LocalSyncStorage.remove(key);
    }
};
