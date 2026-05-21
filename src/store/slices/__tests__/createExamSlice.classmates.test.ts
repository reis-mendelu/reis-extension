import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/storage', () => ({
    IndexedDBService: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('../../../services/sync/SyncService', () => ({
    syncService: { triggerExamRefresh: vi.fn() },
}));

vi.mock('../exams/fetchExamClassmatesForTermin', () => ({
    fetchAndPersistExamClassmates: vi.fn(),
    persistLastExamClassmatesFetched: vi.fn(),
    EXAM_CLASSMATES_LAST_FETCHED_KEY: 'exam_classmates_last_fetched',
}));

vi.mock('../exams/fetchAllExamClassmates', () => ({
    loadAllExamClassmatesFromCache: vi.fn(),
}));

vi.mock('../../../utils/reportError', () => ({
    logError: vi.fn(),
}));

import { createExamSlice } from '../createExamSlice';
import { IndexedDBService } from '../../../services/storage';
import {
    fetchAndPersistExamClassmates,
    persistLastExamClassmatesFetched,
} from '../exams/fetchExamClassmatesForTermin';
import { loadAllExamClassmatesFromCache } from '../exams/fetchAllExamClassmates';

interface SliceState {
    exams: { data: unknown[]; status: string; error: string | null };
    examClassmates: Record<string, unknown[]>;
    examClassmatesLoading: Record<string, boolean>;
    lastExamClassmatesFetchedAt: Record<string, number>;
    examClassmatesError: Record<string, string>;
    studiumId: string | null;
    obdobiId: string | null;
}

describe('createExamSlice classmates portion', () => {
    let state: SliceState;
    let slice: ReturnType<typeof createExamSlice>;
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        state = {
            exams: { data: [], status: 'idle', error: null },
            examClassmates: {},
            examClassmatesLoading: {},
            lastExamClassmatesFetchedAt: {},
            examClassmatesError: {},
            studiumId: '149707',
            obdobiId: '812',
        };
        set = vi.fn((updater) => {
            const patch = typeof updater === 'function' ? updater(state) : updater;
            Object.assign(state, patch);
            Object.assign(slice, patch);
        });
        get = vi.fn(() => ({ ...state, ...slice }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slice = createExamSlice(set, get, {} as any);
    });

    it('initializes with empty maps', () => {
        expect(slice.examClassmates).toEqual({});
        expect(slice.examClassmatesLoading).toEqual({});
        expect(slice.lastExamClassmatesFetchedAt).toEqual({});
        expect(slice.examClassmatesError).toEqual({});
    });

    it('fetchAllExamClassmates does NOT call set() when exams unknown (poison-empty guard)', async () => {
        vi.mocked(loadAllExamClassmatesFromCache).mockResolvedValueOnce(null);
        set.mockClear();

        await slice.fetchAllExamClassmates();

        // set() should not be called with examClassmates from the loader
        const examPatches = set.mock.calls.filter(c => c[0]?.examClassmates !== undefined);
        expect(examPatches).toHaveLength(0);
    });

    it('fetchAllExamClassmates sets the map when loader returns data', async () => {
        const data = { '111': [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }] };
        vi.mocked(loadAllExamClassmatesFromCache).mockResolvedValueOnce(data);

        await slice.fetchAllExamClassmates();

        expect(state.examClassmates).toEqual(data);
    });

    it('fetchExamClassmatesPriority dedups when entry already exists', async () => {
        state.examClassmates = { '111': [] };
        Object.assign(slice, { examClassmates: { '111': [] } });

        await slice.fetchExamClassmatesPriority('111');

        expect(fetchAndPersistExamClassmates).not.toHaveBeenCalled();
        expect(IndexedDBService.get).not.toHaveBeenCalled();
    });

    it('fetchExamClassmatesPriority rehydrates from IDB when cache exists', async () => {
        const cached = [{ personId: 7, name: 'X', photoUrl: 'p', studyInfo: 's' }];
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce(cached);

        await slice.fetchExamClassmatesPriority('111');

        expect(IndexedDBService.get).toHaveBeenCalledWith('classmates', 'exam:111');
        expect(state.examClassmates['111']).toEqual(cached);
        expect(state.examClassmatesLoading['111']).toBe(false);
        expect(fetchAndPersistExamClassmates).not.toHaveBeenCalled();
    });

    it('fetchExamClassmatesPriority fetches from network on cache miss, persists timestamp, clears error', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce(undefined);
        const data = [{ personId: 9, name: 'N', photoUrl: 'p', studyInfo: 's' }];
        vi.mocked(fetchAndPersistExamClassmates).mockResolvedValueOnce({ data, fetchedAt: 12345 });

        state.examClassmatesError = { '111': 'old failure' };
        Object.assign(slice, { examClassmatesError: { '111': 'old failure' } });

        await slice.fetchExamClassmatesPriority('111');

        expect(state.examClassmates['111']).toEqual(data);
        expect(state.lastExamClassmatesFetchedAt['111']).toBe(12345);
        expect(state.examClassmatesError['111']).toBeUndefined();
        expect(persistLastExamClassmatesFetched).toHaveBeenCalled();
    });

    it('fetchExamClassmatesPriority surfaces error and defaults to [] on failure', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce(undefined);
        vi.mocked(fetchAndPersistExamClassmates).mockRejectedValueOnce(new Error('boom'));

        await slice.fetchExamClassmatesPriority('111');

        expect(state.examClassmatesError['111']).toBe('boom');
        expect(state.examClassmatesLoading['111']).toBe(false);
        expect(state.examClassmates['111']).toEqual([]);
    });

    it('fetchExamClassmatesPriority noops without studiumId/obdobiId on cache miss', async () => {
        state.studiumId = null;
        state.obdobiId = null;
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce(undefined);
        vi.mocked(fetchAndPersistExamClassmates).mockResolvedValueOnce(null);

        await slice.fetchExamClassmatesPriority('111');

        expect(state.examClassmates['111']).toEqual([]);
        expect(state.examClassmatesLoading['111']).toBe(false);
    });

    it('refreshExamClassmatesForTermin advances lastExamClassmatesFetchedAt', async () => {
        const data = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
        vi.mocked(fetchAndPersistExamClassmates).mockResolvedValueOnce({ data, fetchedAt: 99999 });

        await slice.refreshExamClassmatesForTermin('111');

        expect(state.lastExamClassmatesFetchedAt['111']).toBe(99999);
        expect(state.examClassmates['111']).toEqual(data);
    });

    it('refreshExamClassmatesForTermin skips re-entry when already loading', async () => {
        state.examClassmatesLoading = { '111': true };
        Object.assign(slice, { examClassmatesLoading: { '111': true } });

        await slice.refreshExamClassmatesForTermin('111');

        expect(fetchAndPersistExamClassmates).not.toHaveBeenCalled();
    });

    it('hydrateLastExamClassmatesFetchedAt reads from meta store', async () => {
        vi.mocked(IndexedDBService.get).mockResolvedValueOnce({ '111': 12345 });

        await slice.hydrateLastExamClassmatesFetchedAt();

        expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'exam_classmates_last_fetched');
        expect(state.lastExamClassmatesFetchedAt).toEqual({ '111': 12345 });
    });
});
