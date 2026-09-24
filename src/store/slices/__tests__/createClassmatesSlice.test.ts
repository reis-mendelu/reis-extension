import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(),
    set: vi.fn(),
    setMany: vi.fn(),
  },
}));

vi.mock('../classmates/fetchClassmatesForSubject', () => ({
  fetchAndPersistClassmates: vi.fn(),
  persistLastClassmatesFetched: vi.fn(),
  persistClassmatesNoSeminar: vi.fn(),
  CLASSMATES_LAST_FETCHED_KEY: 'classmates_last_fetched',
  CLASSMATES_NO_SEMINAR_KEY: 'classmates_no_seminar',
}));

vi.mock('../classmates/fetchAllClassmates', () => ({
  loadAllClassmatesFromCache: vi.fn(),
}));

vi.mock('../../../utils/reportError', () => ({
  logError: vi.fn(),
}));

import { createClassmatesSlice } from '../createClassmatesSlice';
import { IndexedDBService } from '../../../services/storage';
import {
  fetchAndPersistClassmates,
  persistLastClassmatesFetched,
  persistClassmatesNoSeminar,
} from '../classmates/fetchClassmatesForSubject';
import { loadAllClassmatesFromCache } from '../classmates/fetchAllClassmates';

interface SliceState {
  classmates: Record<string, unknown[]>;
  classmatesLoading: Record<string, boolean>;
  lastClassmatesFetchedAt: Record<string, number>;
  classmatesError: Record<string, string>;
  classmatesNoSeminar: Record<string, boolean>;
  subjects: { data: Record<string, { subjectId?: string }> } | null;
}

describe('createClassmatesSlice', () => {
  let state: SliceState;
  let slice: ReturnType<typeof createClassmatesSlice>;
  let set: Mock & Parameters<typeof createClassmatesSlice>[0];
  let get: Mock & Parameters<typeof createClassmatesSlice>[1];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IndexedDBService.get).mockReset();
    state = {
      classmates: {},
      classmatesLoading: {},
      lastClassmatesFetchedAt: {},
      classmatesError: {},
      classmatesNoSeminar: {},
      subjects: { data: { ALG: { subjectId: '162527' } } },
    };
    set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      Object.assign(state, patch);
      Object.assign(slice, patch);
    });
    get = vi.fn(() => ({ ...state, ...slice })) as unknown as typeof get;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slice = createClassmatesSlice(set, get, {} as any);
  });

  it('initializes with empty maps', () => {
    expect(slice.classmates).toEqual({});
    expect(slice.classmatesLoading).toEqual({});
    expect(slice.lastClassmatesFetchedAt).toEqual({});
    expect(slice.classmatesError).toEqual({});
    expect(slice.classmatesNoSeminar).toEqual({});
  });

  it('fetchAllClassmates does NOT call set() when subjects is null (poison-empty guard)', async () => {
    vi.mocked(loadAllClassmatesFromCache).mockResolvedValueOnce(null);
    const setSpy = set;
    setSpy.mockClear();

    await slice.fetchAllClassmates();

    expect(setSpy).not.toHaveBeenCalled();
  });

  it('fetchAllClassmates sets the map when loader returns data', async () => {
    const data = { ALG: [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }] };
    vi.mocked(loadAllClassmatesFromCache).mockResolvedValueOnce(data);

    await slice.fetchAllClassmates();

    expect(state.classmates).toEqual(data);
  });

  it('fetchClassmatesPriority dedups when entry already exists', async () => {
    state.classmates = { ALG: [] };
    Object.assign(slice, { classmates: { ALG: [] } });

    await slice.fetchClassmatesPriority('ALG');

    expect(fetchAndPersistClassmates).not.toHaveBeenCalled();
    expect(IndexedDBService.get).not.toHaveBeenCalled();
  });

  it('fetchClassmatesPriority rehydrates from IDB when cache exists', async () => {
    const cached = [{ personId: 7, name: 'X', photoUrl: 'p', studyInfo: 's' }];
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce(cached);

    await slice.fetchClassmatesPriority('ALG');

    expect(state.classmates.ALG).toEqual(cached);
    expect(state.classmatesLoading.ALG).toBe(false);
    expect(fetchAndPersistClassmates).not.toHaveBeenCalled();
  });

  it('fetchClassmatesPriority fetches from network when no IDB cache, persists timestamp, clears error', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce(undefined);
    const data = [{ personId: 9, name: 'N', photoUrl: 'p', studyInfo: 's' }];
    vi.mocked(fetchAndPersistClassmates).mockResolvedValueOnce({
      data,
      fetchedAt: 12345,
      noSeminar: false,
    });

    // Pre-existing error should be cleared on success
    state.classmatesError = { ALG: 'old failure' };
    Object.assign(slice, { classmatesError: { ALG: 'old failure' } });

    await slice.fetchClassmatesPriority('ALG');

    expect(state.classmates.ALG).toEqual(data);
    expect(state.lastClassmatesFetchedAt.ALG).toBe(12345);
    expect(state.classmatesError.ALG).toBeUndefined();
    expect(persistLastClassmatesFetched).toHaveBeenCalled();
  });

  it('fetchClassmatesPriority surfaces error and preserves existing data on failure', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce(undefined);
    vi.mocked(fetchAndPersistClassmates).mockRejectedValueOnce(new Error('boom'));

    await slice.fetchClassmatesPriority('ALG');

    expect(state.classmatesError.ALG).toBe('boom');
    expect(state.classmatesLoading.ALG).toBe(false);
  });

  it('refreshClassmatesForSubject updates lastClassmatesFetchedAt', async () => {
    const data = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
    vi.mocked(fetchAndPersistClassmates).mockResolvedValueOnce({
      data,
      fetchedAt: 99999,
      noSeminar: false,
    });

    await slice.refreshClassmatesForSubject('ALG');

    expect(state.lastClassmatesFetchedAt.ALG).toBe(99999);
    expect(state.classmates.ALG).toEqual(data);
  });

  it('hydrateLastClassmatesFetchedAt reads from meta store', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce({ ALG: 12345 });

    await slice.hydrateLastClassmatesFetchedAt();

    expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'classmates_last_fetched');
    expect(state.lastClassmatesFetchedAt).toEqual({ ALG: 12345 });
  });

  it('records and persists that a subject has no seminar group', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValueOnce(undefined);
    vi.mocked(fetchAndPersistClassmates).mockResolvedValueOnce({
      data: [],
      fetchedAt: 1,
      noSeminar: true,
    });

    await slice.fetchClassmatesPriority('ALG');

    expect(state.classmates.ALG).toEqual([]);
    expect(state.classmatesNoSeminar.ALG).toBe(true);
    expect(persistClassmatesNoSeminar).toHaveBeenCalledWith({ ALG: true });
  });

  it('clears the flag once the subject gets a seminar group', async () => {
    state.classmatesNoSeminar = { ALG: true };
    Object.assign(slice, { classmatesNoSeminar: { ALG: true } });
    const data = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
    vi.mocked(fetchAndPersistClassmates).mockResolvedValueOnce({
      data,
      fetchedAt: 2,
      noSeminar: false,
    });

    await slice.refreshClassmatesForSubject('ALG');

    expect(state.classmatesNoSeminar.ALG).toBeUndefined();
    expect(persistClassmatesNoSeminar).toHaveBeenCalledWith({});
  });

  it('hydrateLastClassmatesFetchedAt also restores the no-seminar flags', async () => {
    vi.mocked(IndexedDBService.get).mockImplementation(async (_store, key) =>
      key === 'classmates_no_seminar' ? { ALG: true } : { ALG: 12345 }
    );

    await slice.hydrateLastClassmatesFetchedAt();

    expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'classmates_no_seminar');
    expect(state.classmatesNoSeminar).toEqual({ ALG: true });
  });
});
