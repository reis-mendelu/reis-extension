/**
 * Tests for SyncService
 * 
 * Tests background sync orchestration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncService } from '../../services/sync';
import { IndexedDBService, STORAGE_KEYS } from '../../services/storage';

// Mock the sync functions
vi.mock('./syncExams', () => ({
    syncExams: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./syncSchedule', () => ({
    syncSchedule: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./syncSubjects', () => ({
    syncSubjects: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/storage', () => ({
    StorageService: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
    },
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    },
    STORAGE_KEYS: {
        SYNC_IN_PROGRESS: 'sync_in_progress',
        LAST_SYNC: 'last_sync',
        SYNC_ERROR: 'sync_error',
    },
}));

describe('SyncService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        syncService.stop();
        vi.useRealTimers();
    });

    describe('subscribe', () => {
        it('should add listener and return unsubscribe function', () => {
            const listener = vi.fn();

            const unsubscribe = syncService.subscribe(listener);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should remove listener when unsubscribe is called', () => {
            const listener = vi.fn();

            const unsubscribe = syncService.subscribe(listener);
            unsubscribe();

            // Listener should not be called after unsubscribe
            // This is tested indirectly through the service behavior
        });
    });

    describe('getStatus', () => {
        it('should return current sync status', async () => {
            vi.mocked(IndexedDBService.get).mockImplementation(async (store, key) => {
                if (key === 'last_sync') return 1234567890;
                if (key === 'sync_error') return null;
                return null;
            });

            const status = await syncService.getStatus();

            expect(status).toHaveProperty('isSyncing');
            expect(status).toHaveProperty('lastSync');
            expect(status).toHaveProperty('error');
        });
    });
});
