/* eslint-disable no-restricted-globals */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-restricted-syntax */
import { IndexedDBService, STORAGE_KEYS } from '../storage';

export async function migrateAndCleanup(): Promise<void> {
    try {
        const lsPrefixes = ['reis_', 'assessment-adjustments-', 'bonus-points-', 'user_id'];
        
        // Direct access to localStorage for migration purposes ONLY
        const getKeys = (prefix: string) => {
             const keys: string[] = [];
             for (let i = 0; i < localStorage.length; i++) {
                 const k = localStorage.key(i);
                 if (k?.startsWith(prefix)) keys.push(k);
             }
             return keys;
        };

        let allLsKeys: string[] = [];
        lsPrefixes.forEach(p => allLsKeys = [...allLsKeys, ...getKeys(p)]);

        const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;

        if (allLsKeys.length === 0 && !hasChromeStorage) return;

        for (const key of allLsKeys) {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
                try {
                    const val = JSON.parse(raw);
                    await migrateKey(key, val);
                } catch {
                    // Ignore parse errors
                }
            }
        }

        if (hasChromeStorage) {
            try {
                const all = await chrome.storage.local.get(null);
                const keys = Object.keys(all).filter(k => k.startsWith('reis_'));
                for (const key of keys) await migrateKey(key, all[key]);
            } catch (e) {
                console.warn('[SyncMigration] Failed to read chrome.storage.local', e);
            }
        }

        // Cleanup
        for (const key of allLsKeys) {
            localStorage.removeItem(key);
        }

        if (hasChromeStorage) {
            try {
                const all = await chrome.storage.local.get(null);
                const keys = Object.keys(all).filter(k => lsPrefixes.some(p => k.startsWith(p)));
                if (keys.length > 0) await chrome.storage.local.remove(keys);
            } catch (e) {
                console.warn('[SyncMigration] Failed to clean chrome.storage.local', e);
            }
        }
    } catch (e) { console.error('[SyncService] Migration failed:', e); }
}

async function migrateKey(key: string, value: any): Promise<void> {
    try {
        if (key === STORAGE_KEYS.SCHEDULE_DATA) await IndexedDBService.set('schedule', 'current', value);
        else if (key === STORAGE_KEYS.SCHEDULE_WEEK_START) await IndexedDBService.set('meta', 'schedule_week_start', value);
        else if (key === STORAGE_KEYS.EXAMS_DATA) await IndexedDBService.set('exams', 'current', value);
        else if (key === STORAGE_KEYS.SUBJECTS_DATA) await IndexedDBService.set('subjects', 'current', value);
        else if (key === STORAGE_KEYS.USER_PARAMS) await IndexedDBService.set('meta', STORAGE_KEYS.USER_PARAMS, value);
        else if (key === STORAGE_KEYS.STUDY_PROGRAM_DATA) await IndexedDBService.set('meta', 'study_program', value);
        else if (key === STORAGE_KEYS.LAST_SYNC) await IndexedDBService.set('meta', 'last_sync', value);
        else if (key === STORAGE_KEYS.SYNC_ERROR) await IndexedDBService.set('meta', 'sync_error', value);
        else if (key.startsWith(STORAGE_KEYS.SUBJECT_FILES_PREFIX)) await IndexedDBService.set('files', key.replace(STORAGE_KEYS.SUBJECT_FILES_PREFIX, ''), value);
        else if (key.startsWith(STORAGE_KEYS.SUBJECT_ASSESSMENTS_PREFIX)) await IndexedDBService.set('assessments', key.replace(STORAGE_KEYS.SUBJECT_ASSESSMENTS_PREFIX, ''), value);
        else if (key.startsWith(STORAGE_KEYS.SUBJECT_SYLLABUS_PREFIX)) await IndexedDBService.set('syllabuses', key.replace(STORAGE_KEYS.SUBJECT_SYLLABUS_PREFIX, ''), value);
        else if (key === STORAGE_KEYS.SUCCESS_RATES_DATA) await IndexedDBService.set('success_rates', 'current', value);
        else if (key === 'reis_calendar_click_hint_shown') await IndexedDBService.set('meta', 'calendar_click_hint_shown', value === 'true');
        else if (key === 'reis_drag_hint_shown') await IndexedDBService.set('meta', 'drag_hint_shown', value === 'true');
        else if (key === 'reis_welcome_dismissed') await IndexedDBService.set('meta', 'welcome_dismissed', value === 'true');
        else if (key === 'reis_read_notifications') await IndexedDBService.set('meta', 'read_notifications', value);
        else if (key.startsWith('assessment-adjustments-')) await IndexedDBService.set('meta', `assessment_adjustments_${key.replace('assessment-adjustments-', '')}`, value);
        else if (key.startsWith('bonus-points-')) await IndexedDBService.set('meta', `bonus_points_${key.replace('bonus-points-', '')}`, value);
        else if (key === 'user_id') await IndexedDBService.set('meta', 'user_id', value);
        else await IndexedDBService.set('meta', key, value);
    } catch (err) { console.warn(`[SyncService] Failed to migrate ${key}:`, err); }
}
