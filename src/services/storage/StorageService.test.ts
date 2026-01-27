/**
 * Tests for StorageService
 * 
 * Tests the new async-first implementation backed by IndexedDB
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './StorageService';
import { IndexedDBService } from './IndexedDBService';

// Mock IndexedDBService
vi.mock('./IndexedDBService', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
    }
}));

describe('StorageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Deprecated Synchronous Methods', () => {
        it('get() should throw error', () => {
            expect(() => StorageService.get('key')).toThrow(/deprecated/);
        });

        it('set() should throw error', () => {
            expect(() => StorageService.set('key', 'value')).toThrow(/deprecated/);
        });

        it('remove() should throw error', () => {
            expect(() => StorageService.remove('key')).toThrow(/deprecated/);
        });
    });

    describe('getAsync', () => {
        it('should call IndexedDBService.get with "meta" store', async () => {
            const mockValue = { foo: 'bar' };
            vi.mocked(IndexedDBService.get).mockResolvedValue(mockValue);

            const result = await StorageService.getAsync('test_key');
            
            expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'test_key');
            expect(result).toEqual(mockValue);
        });

        it('should return null if IndexedDB returns undefined', async () => {
            vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);

            const result = await StorageService.getAsync('missing_key');
            
            expect(result).toBeNull();
        });
    });

    describe('setAsync', () => {
        it('should call IndexedDBService.set with "meta" store', async () => {
            const testData = { config: true };
            
            await StorageService.setAsync('config_key', testData);

            expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'config_key', testData);
        });
    });

    describe('removeAsync', () => {
        it('should call IndexedDBService.delete with "meta" store', async () => {
            await StorageService.removeAsync('old_key');

            expect(IndexedDBService.delete).toHaveBeenCalledWith('meta', 'old_key');
        });
    });
});
