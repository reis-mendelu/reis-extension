import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

interface StoreShape {
  subjectClassmates: Record<string, unknown[]>;
  subjectClassmatesLoading: Record<string, boolean>;
  subjectClassmatesError: Record<string, string>;
  lastSubjectClassmatesFetchedAt: Record<string, number>;
  fetchSubjectClassmatesPriority: ReturnType<typeof vi.fn>;
  refreshSubjectClassmates: ReturnType<typeof vi.fn>;
}

vi.mock('../../../store/useAppStore', () => {
  const state: StoreShape = {
    subjectClassmates: {},
    subjectClassmatesLoading: {},
    subjectClassmatesError: {},
    lastSubjectClassmatesFetchedAt: {},
    fetchSubjectClassmatesPriority: vi.fn(),
    refreshSubjectClassmates: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useAppStore: any = (selector: (s: StoreShape) => unknown) => selector(state);
  useAppStore.getState = () => state;
  useAppStore.__state = state;
  return { useAppStore };
});

import { useSubjectClassmates } from '../useSubjectClassmates';
import { useAppStore } from '../../../store/useAppStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = (useAppStore as any).__state as StoreShape;

describe('useSubjectClassmates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.subjectClassmates = {};
    store.subjectClassmatesLoading = {};
    store.subjectClassmatesError = {};
    store.lastSubjectClassmatesFetchedAt = {};
  });

  it('asks the store for nothing while the toggle is on Cvičení', () => {
    const { result } = renderHook(() => useSubjectClassmates('MNG', false));
    expect(store.fetchSubjectClassmatesPriority).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('asks the store once the student switches to Celý předmět', () => {
    const { result } = renderHook(() => useSubjectClassmates('MNG', true));
    expect(store.fetchSubjectClassmatesPriority).toHaveBeenCalledWith('MNG');
    expect(result.current.isLoading).toBe(true);
  });

  it('refreshes a list that has been in memory past a day', () => {
    store.subjectClassmates = { MNG: [] };
    store.lastSubjectClassmatesFetchedAt = { MNG: Date.now() - 25 * 60 * 60 * 1000 };
    renderHook(() => useSubjectClassmates('MNG', true));
    expect(store.refreshSubjectClassmates).toHaveBeenCalledWith('MNG');
  });

  it('is not loading after a failed first fetch, so the error can show', () => {
    store.subjectClassmatesError = { MNG: 'IS 500' };
    const { result } = renderHook(() => useSubjectClassmates('MNG', true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('IS 500');
  });
});
