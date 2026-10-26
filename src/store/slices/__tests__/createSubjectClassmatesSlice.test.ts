import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../classmates/subjectClassmatesCache', () => ({
  loadCachedSubjectClassmates: vi.fn(),
  fetchAndPersistSubjectClassmates: vi.fn(),
}));

vi.mock('../../../utils/reportError', () => ({
  logError: vi.fn(),
}));

import {
  createSubjectClassmatesSlice,
  SUBJECT_CLASSMATES_STALE_MS,
} from '../createSubjectClassmatesSlice';
import {
  loadCachedSubjectClassmates,
  fetchAndPersistSubjectClassmates,
} from '../classmates/subjectClassmatesCache';

const ROSTER = [{ personId: 1, name: 'Nováková Tereza', photoUrl: 'p', studyInfo: 's' }];

interface SliceState {
  subjectClassmates: Record<string, unknown[]>;
  subjectClassmatesLoading: Record<string, boolean>;
  subjectClassmatesError: Record<string, string>;
  lastSubjectClassmatesFetchedAt: Record<string, number>;
  subjects: { data: Record<string, { subjectId?: string }> } | null;
  impersonation: unknown;
}

describe('createSubjectClassmatesSlice — the whole-subject list, on demand', () => {
  let state: SliceState;
  let slice: ReturnType<typeof createSubjectClassmatesSlice>;
  let set: Mock & Parameters<typeof createSubjectClassmatesSlice>[0];
  let get: Mock & Parameters<typeof createSubjectClassmatesSlice>[1];

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      subjectClassmates: {},
      subjectClassmatesLoading: {},
      subjectClassmatesError: {},
      lastSubjectClassmatesFetchedAt: {},
      subjects: { data: { MNG: { subjectId: '164226' } } },
      impersonation: null,
    };
    set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      Object.assign(state, patch);
      Object.assign(slice, patch);
    });
    get = vi.fn(() => ({ ...state, ...slice })) as unknown as typeof get;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slice = createSubjectClassmatesSlice(set, get, {} as any);
  });

  it('starts empty: nothing is fetched until the student asks', () => {
    expect(slice.subjectClassmates).toEqual({});
    expect(fetchAndPersistSubjectClassmates).not.toHaveBeenCalled();
  });

  it('shows a fresh cached list without going to IS', async () => {
    vi.mocked(loadCachedSubjectClassmates).mockResolvedValue({
      data: ROSTER,
      fetchedAt: Date.now() - 1000,
    });
    await slice.fetchSubjectClassmatesPriority('MNG');

    expect(state.subjectClassmates.MNG).toEqual(ROSTER);
    expect(state.subjectClassmatesLoading.MNG).toBe(false);
    expect(fetchAndPersistSubjectClassmates).not.toHaveBeenCalled();
  });

  it('shows a stale cached list at once, then refreshes it from IS', async () => {
    vi.mocked(loadCachedSubjectClassmates).mockResolvedValue({
      data: ROSTER,
      fetchedAt: Date.now() - SUBJECT_CLASSMATES_STALE_MS - 1,
    });
    const fresh = [...ROSTER, { personId: 2, name: 'Dvořák Jakub', photoUrl: 'p', studyInfo: 's' }];
    vi.mocked(fetchAndPersistSubjectClassmates).mockResolvedValue({ data: fresh, fetchedAt: 5 });

    await slice.fetchSubjectClassmatesPriority('MNG');

    expect(fetchAndPersistSubjectClassmates).toHaveBeenCalledWith({
      courseCode: 'MNG',
      subjects: state.subjects,
    });
    expect(state.subjectClassmates.MNG).toEqual(fresh);
    expect(state.lastSubjectClassmatesFetchedAt.MNG).toBe(5);
  });

  it('fetches from IS when nothing is cached, and is loading meanwhile', async () => {
    vi.mocked(loadCachedSubjectClassmates).mockResolvedValue(null);
    let seenLoading = false;
    vi.mocked(fetchAndPersistSubjectClassmates).mockImplementation(async () => {
      seenLoading = state.subjectClassmatesLoading.MNG === true;
      return { data: ROSTER, fetchedAt: 7 };
    });

    await slice.fetchSubjectClassmatesPriority('MNG');

    expect(seenLoading).toBe(true);
    expect(state.subjectClassmates.MNG).toEqual(ROSTER);
    expect(state.subjectClassmatesLoading.MNG).toBe(false);
  });

  it('does nothing twice: a list already in the store is not re-read', async () => {
    state.subjectClassmates = { MNG: ROSTER };
    state.lastSubjectClassmatesFetchedAt = { MNG: Date.now() };
    Object.assign(slice, { subjectClassmates: state.subjectClassmates });

    await slice.fetchSubjectClassmatesPriority('MNG');

    expect(loadCachedSubjectClassmates).not.toHaveBeenCalled();
    expect(fetchAndPersistSubjectClassmates).not.toHaveBeenCalled();
  });

  it('records the error and keeps no list when the first fetch fails', async () => {
    vi.mocked(loadCachedSubjectClassmates).mockResolvedValue(null);
    vi.mocked(fetchAndPersistSubjectClassmates).mockRejectedValue(new Error('IS 500'));

    await slice.fetchSubjectClassmatesPriority('MNG');

    expect(state.subjectClassmatesError.MNG).toBe('IS 500');
    expect(state.subjectClassmatesLoading.MNG).toBe(false);
    expect(state.subjectClassmates.MNG).toBeUndefined();
  });

  it('a retry clears the error and fetches again', async () => {
    state.subjectClassmatesError = { MNG: 'IS 500' };
    vi.mocked(fetchAndPersistSubjectClassmates).mockResolvedValue({ data: ROSTER, fetchedAt: 9 });

    await slice.refreshSubjectClassmates('MNG');

    expect(state.subjectClassmatesError.MNG).toBeUndefined();
    expect(state.subjectClassmates.MNG).toEqual(ROSTER);
  });

  it('keeps the list it has when a refresh fails', async () => {
    state.subjectClassmates = { MNG: ROSTER };
    vi.mocked(fetchAndPersistSubjectClassmates).mockRejectedValue(new Error('offline'));

    await slice.refreshSubjectClassmates('MNG');

    expect(state.subjectClassmates.MNG).toEqual(ROSTER);
    expect(state.subjectClassmatesError.MNG).toBe('offline');
  });

  it('is inert while impersonating — another student’s subjects are in the store', async () => {
    state.impersonation = { studentId: 'x' };
    await slice.fetchSubjectClassmatesPriority('MNG');
    await slice.refreshSubjectClassmates('MNG');
    expect(loadCachedSubjectClassmates).not.toHaveBeenCalled();
    expect(fetchAndPersistSubjectClassmates).not.toHaveBeenCalled();
  });
});
