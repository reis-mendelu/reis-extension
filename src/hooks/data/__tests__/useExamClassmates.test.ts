import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

interface StoreShape {
    examClassmates: Record<string, unknown[]>;
    examClassmatesLoading: Record<string, boolean>;
    lastExamClassmatesFetchedAt: Record<string, number>;
    examClassmatesError: Record<string, string>;
    fetchExamClassmatesPriority: ReturnType<typeof vi.fn>;
    refreshExamClassmatesForTermin: ReturnType<typeof vi.fn>;
}

vi.mock('../../../store/useAppStore', () => {
    const state: StoreShape = {
        examClassmates: {},
        examClassmatesLoading: {},
        lastExamClassmatesFetchedAt: {},
        examClassmatesError: {},
        fetchExamClassmatesPriority: vi.fn(),
        refreshExamClassmatesForTermin: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useAppStore: any = (selector: (s: StoreShape) => unknown) => selector(state);
    useAppStore.getState = () => state;
    useAppStore.__state = state;
    return { useAppStore };
});

import { useExamClassmates } from '../useExamClassmates';
import { useAppStore } from '../../../store/useAppStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = (useAppStore as any).__state as StoreShape;

describe('useExamClassmates', () => {
    beforeEach(() => {
        store.examClassmates = {};
        store.examClassmatesLoading = {};
        store.lastExamClassmatesFetchedAt = {};
        store.examClassmatesError = {};
        store.fetchExamClassmatesPriority.mockReset();
        store.refreshExamClassmatesForTermin.mockReset();
    });

    it('returns classmates: null when terminId unknown to store', () => {
        const { result } = renderHook(() => useExamClassmates('111'));
        expect(result.current.classmates).toBeNull();
        expect(result.current.isLoading).toBe(true);
    });

    it('triggers priority fetch when store entry is missing', () => {
        renderHook(() => useExamClassmates('111'));
        expect(store.fetchExamClassmatesPriority).toHaveBeenCalledWith('111');
        expect(store.refreshExamClassmatesForTermin).not.toHaveBeenCalled();
    });

    it('triggers refresh when entry is stale (>24h)', () => {
        store.examClassmates = { '111': [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }] };
        store.lastExamClassmatesFetchedAt = { '111': Date.now() - 25 * 60 * 60 * 1000 };

        renderHook(() => useExamClassmates('111'));

        expect(store.refreshExamClassmatesForTermin).toHaveBeenCalledWith('111');
        expect(store.fetchExamClassmatesPriority).not.toHaveBeenCalled();
    });

    it('does NOT fetch when entry is fresh', () => {
        store.examClassmates = { '111': [] };
        store.lastExamClassmatesFetchedAt = { '111': Date.now() - 1000 };

        renderHook(() => useExamClassmates('111'));

        expect(store.fetchExamClassmatesPriority).not.toHaveBeenCalled();
        expect(store.refreshExamClassmatesForTermin).not.toHaveBeenCalled();
    });

    it('returns empty array (not null) when loaded and empty', () => {
        store.examClassmates = { '111': [] };
        store.lastExamClassmatesFetchedAt = { '111': Date.now() };

        const { result } = renderHook(() => useExamClassmates('111'));

        expect(result.current.classmates).toEqual([]);
        expect(result.current.isLoading).toBe(false);
    });

    it('surfaces error from store', () => {
        store.examClassmates = { '111': [] };
        store.lastExamClassmatesFetchedAt = { '111': Date.now() };
        store.examClassmatesError = { '111': 'network down' };

        const { result } = renderHook(() => useExamClassmates('111'));

        expect(result.current.error).toBe('network down');
    });

    it('returns null and not-loading when terminId is undefined', () => {
        const { result } = renderHook(() => useExamClassmates(undefined));
        expect(result.current.classmates).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(store.fetchExamClassmatesPriority).not.toHaveBeenCalled();
    });
});
