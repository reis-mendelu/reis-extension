/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSearch } from '../useSearch';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

vi.mock('../../../store/useAppStore', () => ({ useAppStore: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: vi.fn() }));

const mockExecuteSearch = vi.fn();

function setup({ language = 'en', userFaculty = 'PEF' as string | null } = {}) {
  const state: any = {
    subjects: { data: {} },
    recentSearches: [],
    saveRecentSearch: vi.fn(),
    executeSearch: mockExecuteSearch,
    studyPlanDual: null,
    studiumId: 's1',
    userFaculty,
    userSemester: null,
  };
  vi.mocked(useAppStore).mockImplementation((sel?: any) => (sel ? sel(state) : state));
  vi.mocked(useTranslation).mockReturnValue({ t: (k: string) => k, language } as any);
}

describe('useSearch — faculty scope + language wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSearch.mockResolvedValue({ people: [], subjects: [], subjectsTruncated: false });
  });

  it('searches the active language scoped to the student faculty by default', async () => {
    setup({ language: 'en', userFaculty: 'PEF' });
    const { result } = renderHook(() => useSearch('management'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalled());
    expect(mockExecuteSearch).toHaveBeenLastCalledWith('management', 'en', '43110');
    expect(result.current.canWiden).toBe(true);
  });

  it('widenToUniversity drops the faculty restriction', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    const { result } = renderHook(() => useSearch('marketing'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalled());
    expect(mockExecuteSearch).toHaveBeenLastCalledWith('marketing', 'cz', '43110');

    act(() => result.current.widenToUniversity());
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenLastCalledWith('marketing', 'cz', undefined));
    expect(result.current.scope).toBe('all');
  });

  it('searches university-wide (no widen control) when the faculty is unknown', async () => {
    setup({ language: 'en', userFaculty: null });
    const { result } = renderHook(() => useSearch('webova'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalled());
    expect(mockExecuteSearch).toHaveBeenLastCalledWith('webova', 'en', undefined);
    expect(result.current.canWiden).toBe(false);
  });

  it('does not hit the network for queries shorter than 2 chars', async () => {
    setup();
    renderHook(() => useSearch('a'));
    await new Promise(r => setTimeout(r, 300));
    expect(mockExecuteSearch).not.toHaveBeenCalled();
  });
});
