/**
 * ChromeSyncService - Abstraction over chrome.storage.sync for cloud-synced data.
 * 
 * Use this service for small, user-specific data that should follow the user
 * across multiple devices (e.g., subject notes).
 * 
 * Limits: ~100KB total, ~8KB per item.
 */

export const ChromeSyncService = {
    /**
     * Check if chrome.storage.sync is available.
     */
    isAvailable(): boolean {
        return typeof chrome !== 'undefined' && !!chrome.storage?.sync;
    },

    /**
     * Get a value from chrome.storage.sync.
     */
    async get<T>(key: string): Promise<T | null> {
        if (!this.isAvailable()) {
            return null;
        }

        try {
            const result = await chrome.storage.sync.get(key);
            return (result[key] as T) ?? null;
        } catch (error) {
            console.warn(`[ChromeSyncService] Failed to get key "${key}":`, error);
            return null;
        }
    },

    /**
     * Set a value in chrome.storage.sync.
     */
    async set<T>(key: string, value: T): Promise<void> {
        if (!this.isAvailable()) {
            return;
        }

        try {
            await chrome.storage.sync.set({ [key]: value });
        } catch (error) {
            console.error(`[ChromeSyncService] Failed to set key "${key}":`, error);
        }
    },

    /**
     * Remove a key from chrome.storage.sync.
     */
    async remove(key: string): Promise<void> {
        if (!this.isAvailable()) {
            return;
        }

        try {
            await chrome.storage.sync.remove(key);
        } catch (error) {
            console.warn(`[ChromeSyncService] Failed to remove key "${key}":`, error);
        }
    },

    /**
     * Clear all data in chrome.storage.sync.
     * CAUTION: Destructive operation.
     */
    async clear(): Promise<void> {
        if (!this.isAvailable()) {
            return;
        }

        try {
            await chrome.storage.sync.clear();
        } catch (error) {
            console.warn('[ChromeSyncService] Failed to clear storage:', error);
        }
    }
};
