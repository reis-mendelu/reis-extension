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

describe('useSearch — adversarial inputs & scope toggling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSearch.mockResolvedValue({ people: [], subjects: [], subjectsTruncated: false });
  });

  it('never hits the network for whitespace-only queries', async () => {
    setup();
    renderHook(() => useSearch('     '));
    await new Promise(r => setTimeout(r, 350));
    expect(mockExecuteSearch).not.toHaveBeenCalled();
  });

  it('passes regex-meta queries through verbatim without throwing', async () => {
    setup({ language: 'en', userFaculty: 'PEF' });
    const { result } = renderHook(() => useSearch('.*+?[](){}'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalled());
    expect(mockExecuteSearch).toHaveBeenLastCalledWith('.*+?[](){}', 'en', '43110');
    expect(result.current.sections).toEqual([]);
  });

  it('rapid widen->narrow toggling settles back on faculty scope', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    const { result } = renderHook(() => useSearch('marketing'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalled());

    act(() => { result.current.widenToUniversity(); });
    act(() => { result.current.narrowToFaculty(); });
    act(() => { result.current.widenToUniversity(); });
    act(() => { result.current.narrowToFaculty(); });

    await waitFor(() => expect(result.current.scope).toBe('faculty'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenLastCalledWith('marketing', 'cz', '43110'));
  });

  it('a fresh keystroke resets a widened scope back to faculty (documented behavior)', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    const { result, rerender } = renderHook(({ q }) => useSearch(q), { initialProps: { q: 'mark' } });
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalled());
    act(() => { result.current.widenToUniversity(); });
    await waitFor(() => expect(result.current.scope).toBe('all'));

    rerender({ q: 'marke' }); // user types another char
    await waitFor(() => expect(result.current.scope).toBe('faculty'));
  });

  it('handles a subject result with no code/id without crashing (passthrough, blank id->"")', async () => {
    setup({ language: 'en', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [],
      subjects: [{ id: '', code: '', name: 'Orphan subject', link: 'l', faculty: 'PEF', facultyColor: '#fff', semester: '' }],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('orphan'));
    await waitFor(() => expect(result.current.sections.find(s => s.key === 'subjects')?.results.length).toBe(1));
    const r = result.current.sections.find(s => s.key === 'subjects')!.results[0];
    expect(r.title).toBe('Orphan subject');
    expect(r.subjectId).toBe('');
  });
});
