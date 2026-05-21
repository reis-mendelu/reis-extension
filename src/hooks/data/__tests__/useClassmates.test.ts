import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

interface StoreShape {
    classmates: Record<string, unknown[]>;
    classmatesLoading: Record<string, boolean>;
    lastClassmatesFetchedAt: Record<string, number>;
    classmatesError: Record<string, string>;
    syncStatus: { lastSync: number };
    fetchClassmatesPriority: ReturnType<typeof vi.fn>;
    refreshClassmatesForSubject: ReturnType<typeof vi.fn>;
}

vi.mock('../../../store/useAppStore', () => {
    const state: StoreShape = {
        classmates: {},
        classmatesLoading: {},
        lastClassmatesFetchedAt: {},
        classmatesError: {},
        syncStatus: { lastSync: 0 },
        fetchClassmatesPriority: vi.fn(),
        refreshClassmatesForSubject: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useAppStore: any = (selector: (s: StoreShape) => unknown) => selector(state);
    useAppStore.getState = () => state;
    useAppStore.__state = state;
    return { useAppStore };
});

import { useClassmates } from '../useClassmates';
import { useAppStore } from '../../../store/useAppStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = (useAppStore as any).__state as StoreShape;

describe('useClassmates', () => {
    beforeEach(() => {
        store.classmates = {};
        store.classmatesLoading = {};
        store.lastClassmatesFetchedAt = {};
        store.classmatesError = {};
        store.syncStatus = { lastSync: 0 };
        store.fetchClassmatesPriority.mockReset();
        store.refreshClassmatesForSubject.mockReset();
    });

    it('returns classmates: null when courseCode unknown to store', () => {
        const { result } = renderHook(() => useClassmates('ALG'));
        expect(result.current.classmates).toBeNull();
        expect(result.current.isLoading).toBe(true);
    });

    it('triggers priority fetch when store entry is missing', () => {
        renderHook(() => useClassmates('ALG'));
        expect(store.fetchClassmatesPriority).toHaveBeenCalledWith('ALG');
        expect(store.refreshClassmatesForSubject).not.toHaveBeenCalled();
    });

    it('triggers refresh when entry is stale (>24h)', () => {
        const data = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
        store.classmates = { ALG: data };
        store.lastClassmatesFetchedAt = { ALG: Date.now() - 25 * 60 * 60 * 1000 };

        renderHook(() => useClassmates('ALG'));

        expect(store.refreshClassmatesForSubject).toHaveBeenCalledWith('ALG');
        expect(store.fetchClassmatesPriority).not.toHaveBeenCalled();
    });

    it('does NOT fetch when entry is fresh', () => {
        store.classmates = { ALG: [] };
        store.lastClassmatesFetchedAt = { ALG: Date.now() - 1000 };

        renderHook(() => useClassmates('ALG'));

        expect(store.fetchClassmatesPriority).not.toHaveBeenCalled();
        expect(store.refreshClassmatesForSubject).not.toHaveBeenCalled();
    });

    it('returns empty array (not null) when loaded and empty', () => {
        store.classmates = { ALG: [] };
        store.lastClassmatesFetchedAt = { ALG: Date.now() };

        const { result } = renderHook(() => useClassmates('ALG'));

        expect(result.current.classmates).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });

    it('surfaces error from store', () => {
        store.classmates = { ALG: [] };
        store.lastClassmatesFetchedAt = { ALG: Date.now() };
        store.classmatesError = { ALG: 'network down' };

        const { result } = renderHook(() => useClassmates('ALG'));

        expect(result.current.error).toBe('network down');
    });
});
