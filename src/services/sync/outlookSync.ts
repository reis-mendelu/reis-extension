/**
 * Outlook Sync Service - Manages calendar sync state.
 * 
 * - Checks status once on init (called at app startup)
 * - Caches result in IndexedDBService
 * - Provides toggle method for UI
 */

import { checkOutlookSyncStatus, setOutlookSyncStatus } from '../../api/outlookSync';
import { IndexedDBService } from '../storage';
import { STORAGE_KEYS } from '../storage/keys';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OutlookSyncService');

type OutlookSyncListener = (enabled: boolean | null) => void;

class OutlookSyncServiceClass {
    private listeners: Set<OutlookSyncListener> = new Set();
    private isChecking = false;
    private currentStatus: boolean | null = null;

    /**
     * Initialize the service - check status once.
     * Called at app startup.
     */
    async init(): Promise<void> {
        logger.info('Initializing Outlook Sync Service...');

        // Load cached status first for instant UI
        const cached = await IndexedDBService.get('meta', STORAGE_KEYS.OUTLOOK_SYNC);
        if (cached !== null && cached !== undefined) {
            logger.debug(`Loaded cached status: ${cached ? 'ENABLED' : 'DISABLED'}`);
            this.currentStatus = cached;
            this.notifyListeners();
        }

        // Check actual status from server
        await this.refreshStatus();
    }

    /**
     * Refresh status from server.
     */
    async refreshStatus(): Promise<void> {
        if (this.isChecking) {
            logger.debug('Already checking, skipping...');
            return;
        }

        this.isChecking = true;

        try {
            const status = await checkOutlookSyncStatus();
            this.currentStatus = status;
            await IndexedDBService.set('meta', STORAGE_KEYS.OUTLOOK_SYNC, status);
            logger.info(`Status refreshed: ${status ? 'ENABLED' : 'DISABLED'}`);
            this.notifyListeners();
        } catch (error) {
            logger.error('Failed to refresh status:', error);
            // Keep cached value on error
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Set sync status explicitly.
     */
    async setStatus(enabled: boolean): Promise<void> {
        if (this.currentStatus === enabled) {
            logger.debug(`Status already ${enabled}, skipping update`);
            return;
        }

        logger.info(`Setting sync to: ${enabled ? 'ENABLED' : 'DISABLED'}`);

        // Optimistic update
        this.currentStatus = enabled;
        await IndexedDBService.set('meta', STORAGE_KEYS.OUTLOOK_SYNC, enabled);
        this.notifyListeners();

        // Apply to server
        const success = await setOutlookSyncStatus(enabled);

        if (!success) {
            logger.warn('Server update failed, reverting optimistic update');
            // Revert on failure
            this.currentStatus = !enabled;
            await IndexedDBService.set('meta', STORAGE_KEYS.OUTLOOK_SYNC, !enabled);
            this.notifyListeners();
        }
    }

    /**
     * Toggle sync status.
     */
    async toggle(): Promise<void> {
        await this.setStatus(!this.currentStatus);
    }

    /**
     * Enable sync.
     */
    async enable(): Promise<void> {
        await this.setStatus(true);
    }

    /**
     * Disable sync.
     */
    async disable(): Promise<void> {
        await this.setStatus(false);
    }

    /**
     * Get current status.
     */
    getStatus(): boolean | null {
        return this.currentStatus;
    }

    /**
     * Check if currently refreshing.
     */
    isRefreshing(): boolean {
        return this.isChecking;
    }

    /**
     * Subscribe to status changes.
     */
    subscribe(listener: OutlookSyncListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => {
            try {
                listener(this.currentStatus);
            } catch (error) {
                logger.error('Listener error:', error);
            }
        });
    }
}

export const outlookSyncService = new OutlookSyncServiceClass();
