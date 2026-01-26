/**
 * SyncService - Background data synchronization orchestrator.
 * 
 * Pattern: Stale-while-revalidate
 * - Components show stored data immediately
 * - Sync runs periodically while the page is open
 * - Subscribers are notified when new data is available
 */

import { IndexedDBService, StorageService, STORAGE_KEYS } from '../storage';
import { syncExams } from './syncExams';
import { syncSchedule } from './syncSchedule';
import { syncSubjects } from './syncSubjects';
import { syncFiles } from './syncFiles';
import { syncAssessments } from './syncAssessments';
import { syncSyllabus } from './syncSyllabus';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export type SyncStatus = {
    isSyncing: boolean;
    lastSync: number | null;
    error: string | null;
};

class SyncServiceClass {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private listeners: Set<(action?: string) => void> = new Set();
    private isSyncing = false;

    /**
     * Start the background sync service.
     */
    async start(): Promise<void> {
        if (this.intervalId) {
            console.warn('[SyncService] Already running');
            return;
        }

        // console.log('[SyncService] Starting background sync');
        
        // One-time migration and cleanup
        await this.migrateAndCleanup();

        this.syncAll();
        this.intervalId = setInterval(() => {
            this.syncAll();
        }, SYNC_INTERVAL);
    }

    /**
     * Migrate legacy localStorage and chrome.storage.local data to IndexedDB.
     * Then clear all legacy keys.
     */
    private async migrateAndCleanup(): Promise<void> {
        try {
            const lsPrefixes = ['reis_', 'assessment-adjustments-', 'bonus-points-', 'user_id'];
            let allLsKeys: string[] = [];
            lsPrefixes.forEach(p => {
                allLsKeys = [...allLsKeys, ...StorageService.getKeysWithPrefix(p)];
            });

            if (allLsKeys.length === 0) {
                if (!StorageService.isChromeStorageAvailable()) return;
            }

            console.log(`[SyncService] Found ${allLsKeys.length} legacy localStorage keys, migrating...`);

            // 1. Migrate localStorage
            for (const key of allLsKeys) {
                const value = StorageService.get<unknown>(key);
                if (value !== null) {
                    await this.migrateKey(key, value);
                }
            }

            // 2. Migrate chrome.storage.local if available
            if (StorageService.isChromeStorageAvailable()) {
                const allChrome = await chrome.storage.local.get(null);
                const chromeKeys = Object.keys(allChrome).filter(k => k.startsWith('reis_'));
                
                if (chromeKeys.length > 0) {
                    console.log(`[SyncService] Found ${chromeKeys.length} legacy chrome.storage keys, migrating...`);
                    for (const key of chromeKeys) {
                        await this.migrateKey(key, allChrome[key]);
                    }
                }
            }

            // 3. Clear legacy storage
            lsPrefixes.forEach(p => {
                const keys = StorageService.getKeysWithPrefix(p);
                keys.forEach(k => StorageService.remove(k));
            });

            if (StorageService.isChromeStorageAvailable()) {
                const allChrome = await chrome.storage.local.get(null);
                const chromeKeys = Object.keys(allChrome).filter(k => 
                    lsPrefixes.some(p => k.startsWith(p))
                );
                if (chromeKeys.length > 0) {
                    await chrome.storage.local.remove(chromeKeys);
                }
            }

            console.log('[SyncService] Legacy storage migration and cleanup successful');
        } catch (error) {
            console.error('[SyncService] Legacy storage migration failed:', error);
        }
    }

    private async migrateKey(key: string, value: unknown): Promise<void> {
        // Map keys to IDB stores
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (key === STORAGE_KEYS.SCHEDULE_DATA) await IndexedDBService.set('schedule', 'current', value as any);
            else if (key === STORAGE_KEYS.SCHEDULE_WEEK_START) await IndexedDBService.set('meta', 'schedule_week_start', value);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            else if (key === STORAGE_KEYS.EXAMS_DATA) await IndexedDBService.set('exams', 'current', value as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            else if (key === STORAGE_KEYS.SUBJECTS_DATA) await IndexedDBService.set('subjects', 'current', value as any);
            else if (key === STORAGE_KEYS.USER_PARAMS) await IndexedDBService.set('meta', STORAGE_KEYS.USER_PARAMS, value);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            else if (key === STORAGE_KEYS.STUDY_PROGRAM_DATA) await IndexedDBService.set('study_program', 'current', value as any);
            else if (key === STORAGE_KEYS.LAST_SYNC) await IndexedDBService.set('meta', 'last_sync', value);
            else if (key === STORAGE_KEYS.SYNC_ERROR) await IndexedDBService.set('meta', 'sync_error', value);
            else if (key.startsWith(STORAGE_KEYS.SUBJECT_FILES_PREFIX)) {
                const id = key.replace(STORAGE_KEYS.SUBJECT_FILES_PREFIX, '');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await IndexedDBService.set('files', id, value as any);
            }
            else if (key.startsWith(STORAGE_KEYS.SUBJECT_ASSESSMENTS_PREFIX)) {
                const id = key.replace(STORAGE_KEYS.SUBJECT_ASSESSMENTS_PREFIX, '');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await IndexedDBService.set('assessments', id, value as any);
            }
            else if (key.startsWith(STORAGE_KEYS.SUBJECT_SYLLABUS_PREFIX)) {
                const id = key.replace(STORAGE_KEYS.SUBJECT_SYLLABUS_PREFIX, '');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await IndexedDBService.set('syllabuses', id, value as any);
            }
            else if (key === STORAGE_KEYS.SUCCESS_RATES_DATA) await IndexedDBService.set('success_rates', 'current', value);
            
            // UI State & Hints Migration
            else if (key === 'reis_calendar_click_hint_shown') await IndexedDBService.set('meta', 'calendar_click_hint_shown', value === 'true');
            else if (key === 'reis_drag_hint_shown') await IndexedDBService.set('meta', 'drag_hint_shown', value === 'true');
            else if (key === 'reis_welcome_dismissed') await IndexedDBService.set('meta', 'welcome_dismissed', value === 'true');
            else if (key === 'reis_dev_features') await IndexedDBService.set('meta', 'dev_features_enabled', value === 'true');
            else if (key === 'reis_dev_help_shown_v4') await IndexedDBService.set('meta', 'dev_help_shown_v4', value === 'true');
            
            // Notifications Migration
            else if (key === 'reis_read_notifications') {
                // value is JSON string in LS, need to parse if not already (get<any> does JSON.parse?)
                // StorageService.get uses generic parsing if it's JSON.
                // But legacy components did JSON.stringify.
                // StorageService.get might have already parsed it if it looked like JSON.
                // Let's assume usage of StorageService.set which does stringify.
                // Actually, StorageService.get wrapper usually does parse.
                await IndexedDBService.set('meta', 'read_notifications', value); 
            }
            else if (key === 'reis_viewed_notifications_analytics') await IndexedDBService.set('meta', 'viewed_notifications_analytics', value);
            else if (key === 'reis_notifications_cache') await IndexedDBService.set('meta', 'notifications_cache', value);

            // Assessment Adjustments & Bonus Points Migration
            else if (key.startsWith('assessment-adjustments-')) {
                const courseCode = key.replace('assessment-adjustments-', '');
                await IndexedDBService.set('meta', `assessment_adjustments_${courseCode}`, value);
            }
            else if (key.startsWith('bonus-points-')) {
                const courseCode = key.replace('bonus-points-', '');
                await IndexedDBService.set('meta', `bonus_points_${courseCode}`, value);
            }
            else if (key === 'user_id') {
                await IndexedDBService.set('meta', 'user_id', value);
            }

            else {
                // General meta for any other reis_ prefixed keys
                await IndexedDBService.set('meta', key, value);
            }
        } catch (err) {
            console.warn(`[SyncService] Failed to migrate key ${key}:`, err);
        }
    }

    /**
     * Stop the background sync service.
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[SyncService] Stopped');
        }
    }

    /**
     * Force an immediate sync of all data.
     */
    async syncAll(): Promise<void> {
        if (this.isSyncing) {
            console.log('[SyncService] Sync already in progress, skipping');
            return;
        }

        this.isSyncing = true;
        await IndexedDBService.set('meta', 'sync_in_progress', true);

        // console.log('[SyncService] Starting sync...');

        try {
            const results = await Promise.allSettled([
                syncSchedule(),
                syncExams(),
                syncSubjects(),
            ]);

            results.forEach((result, index) => {
                const syncNames = ['schedule', 'exams', 'subjects'];
                if (result.status === 'rejected') {
                    console.error(`[SyncService] ${syncNames[index]} sync failed:`, result.reason);
                }
            });

            try {
                await syncAssessments();
            } catch (error) {
                console.error('[SyncService] assessments sync failed:', error);
            }

            try {
                await syncSyllabus();
            } catch (error) {
                console.error('[SyncService] syllabus sync failed:', error);
            }

            try {
                await syncFiles();
            } catch (filesError) {
                console.error('[SyncService] files sync failed:', filesError);
            }

            await IndexedDBService.set('meta', 'last_sync', Date.now());
            await IndexedDBService.delete('meta', 'sync_error');

            this.notifyListeners();

        } catch (error) {
            console.error('[SyncService] Sync failed:', error);
            await IndexedDBService.set('meta', 'sync_error', error instanceof Error ? error.message : 'Unknown error');
        } finally {
            this.isSyncing = false;
            await IndexedDBService.delete('meta', 'sync_in_progress');
        }
    }

    subscribe(callback: (action?: string) => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    async getStatus(): Promise<SyncStatus> {
        return {
            isSyncing: this.isSyncing,
            lastSync: await IndexedDBService.get('meta', 'last_sync'),
            error: await IndexedDBService.get('meta', 'sync_error'),
        };
    }

    /**
     * Set external sync status (e.g. from content script)
     */
    setIsSyncing(val: boolean): void {
        this.isSyncing = val;
        this.notifyListeners();
    }

    triggerSync(): void {
        console.log('[SyncService] triggerSync triggered (manual)');
        window.parent.postMessage({
            type: 'REIS_ACTION',
            id: crypto.randomUUID(),
            action: 'trigger_sync',
            payload: {}
        }, '*');
    }

    triggerRefresh(action?: string): void {
        this.notifyListeners(action);
    }

    private notifyListeners(action?: string): void {
        this.listeners.forEach(callback => {
            try {
                callback(action);
            } catch (error) {
                console.error('[SyncService] Listener error:', error);
            }
        });
    }
}

export const syncService = new SyncServiceClass();
