/**
 * Tests for useSubjects hook
 * 
 * Tests the stale-while-revalidate pattern and memoization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSubjects } from '../../hooks/data/useSubjects';
import { IndexedDBService, STORAGE_KEYS } from '../../services/storage';
import { syncService } from '../../services/sync';

// Mock dependencies
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
        SUBJECTS_DATA: 'subjects_data',
    },
}));

vi.mock('../../services/sync', () => ({
    syncService: {
        subscribe: vi.fn(() => vi.fn()), // Returns unsubscribe function
    },
}));

describe('useSubjects', () => {
    const mockSubjectsData = {
        data: {
            'EBC-AP': {
                courseCode: 'EBC-AP',
                fullName: 'Architektura počítačů',
                folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=12345',
            },
            'EBC-PR1': {
                courseCode: 'EBC-PR1',
                fullName: 'Programování 1',
                folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=67890',
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should load subjects from storage on mount', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue(mockSubjectsData);

        const { result } = renderHook(() => useSubjects());

        await waitFor(() => {
            expect(result.current.isLoaded).toBe(true);
        });

        expect(result.current.subjects).toEqual(mockSubjectsData);
        expect(IndexedDBService.get).toHaveBeenCalledWith('subjects', 'current');
    });

    it('should return null when subject not found', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue(mockSubjectsData);

        const { result } = renderHook(() => useSubjects());

        await waitFor(() => {
            expect(result.current.isLoaded).toBe(true);
        });

        const subject = result.current.getSubject('NONEXISTENT');
        expect(subject).toBeNull();
    });

    it('should return correct subject by course code', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue(mockSubjectsData);

        const { result } = renderHook(() => useSubjects());

        await waitFor(() => {
            expect(result.current.isLoaded).toBe(true);
        });

        const subject = result.current.getSubject('EBC-AP');
        expect(subject).toEqual(mockSubjectsData.data['EBC-AP']);
    });

    it('should subscribe to sync service updates', () => {
        renderHook(() => useSubjects());

        expect(syncService.subscribe).toHaveBeenCalledTimes(1);
        expect(syncService.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should unsubscribe on unmount', () => {
        const unsubscribeMock = vi.fn();
        vi.mocked(syncService.subscribe).mockReturnValue(unsubscribeMock);

        const { unmount } = renderHook(() => useSubjects());
        unmount();

        expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('getSubject should have stable reference (memoization test)', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValue(mockSubjectsData);

        const { result, rerender } = renderHook(() => useSubjects());

        await waitFor(() => {
            expect(result.current.isLoaded).toBe(true);
        });

        const firstGetSubject = result.current.getSubject;

        // Rerender without changing subjects
        rerender();

        const secondGetSubject = result.current.getSubject;

        // Should be the same reference (memoized)
        expect(firstGetSubject).toBe(secondGetSubject);
    });
});
