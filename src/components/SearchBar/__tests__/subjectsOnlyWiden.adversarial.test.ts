/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSearch } from '../useSearch';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

vi.mock('../../../store/useAppStore', () => ({ useAppStore: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: vi.fn() }));

const mockExecuteSearch = vi.fn();

function setup({ language = 'cz', userFaculty = 'PEF' as string | null } = {}) {
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

const subj = (id: string, code: string, name: string, semester: string, faculty = 'PEF') =>
  ({ id, code, name, link: `l${id}`, faculty, facultyColor: '#fff', semester });

const person = (id: string, name: string) =>
  ({ id, name, type: 'teacher' as const, link: `p${id}` });

describe('useSearch — subjectsOnly survives widening to university scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('THE critical case: people must not leak in after widenToUniversity when subjectsOnly is set', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    // Faculty-scoped call: only subjects come back (server already filters, but the
    // person array is non-empty here to prove the client-side filter is doing the work).
    mockExecuteSearch.mockResolvedValueOnce({
      people: [person('p1', 'Jan Novák')],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('statistika', true));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(1));
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();
    expect(result.current.sections.find(s => s.key === 'subjects')?.results.length).toBe(1);

    // Widen to whole university — university-wide call returns a *larger* person list
    // (the realistic scenario: no faculty subjekt filter means IS returns way more people).
    mockExecuteSearch.mockResolvedValueOnce({
      people: [person('p1', 'Jan Novák'), person('p2', 'Petr Svoboda'), person('p3', 'Eva Dvořáková')],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026'), subj('9', 'XYZ-ST', 'Statistika II', 'LS 2025/2026', 'AF')],
      subjectsTruncated: false,
    });
    act(() => { result.current.widenToUniversity(); });
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(2));
    expect(mockExecuteSearch).toHaveBeenLastCalledWith('statistika', 'cz', undefined);

    await waitFor(() => expect(result.current.sections.find(s => s.key === 'subjects')?.results.length).toBe(2));
    // The core regression to guard: no 'people' section, ever, post-widen.
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();
    expect(result.current.sections.every(s => s.key !== 'people')).toBe(true);
  });

  it('narrowing back to faculty after a widened subjectsOnly search still excludes people', async () => {
    setup({ language: 'en', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [person('p1', 'A Teacher')],
      subjects: [subj('1', 'ABC-1', 'Course', 'SS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('course', true));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(1));

    act(() => { result.current.widenToUniversity(); });
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(2));
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();

    act(() => { result.current.narrowToFaculty(); });
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(3));
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();
  });

  it('a fresh keystroke resets scope to faculty AND keeps people excluded under subjectsOnly', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [person('p1', 'Someone')],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result, rerender } = renderHook(({ q }) => useSearch(q, true), { initialProps: { q: 'stat' } });
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(1));

    act(() => { result.current.widenToUniversity(); });
    await waitFor(() => expect(result.current.scope).toBe('all'));

    rerender({ q: 'stati' });
    await waitFor(() => expect(result.current.scope).toBe('faculty'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenLastCalledWith('stati', 'cz', '43110'));
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();
  });

  it('subjectsOnly + unknown faculty (no widen control) still excludes people university-wide', async () => {
    setup({ language: 'en', userFaculty: null });
    mockExecuteSearch.mockResolvedValue({
      people: [person('p1', 'Someone')],
      subjects: [subj('1', 'ABC-1', 'Course', 'SS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('course', true));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalled());
    expect(result.current.canWiden).toBe(false);
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();
  });

  it('flipping subjectsOnly true->false on a live hook (defensive: prop should be respected per-render)', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [person('p1', 'Someone')],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result, rerender } = renderHook(({ so }) => useSearch('statistika', so), { initialProps: { so: true } });
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(1));
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();

    // Same query, flip the flag off without a debounce-triggering query change.
    // The merge effect only re-derives sections on its own debounced fetch (keyed off
    // query/isLang/effectiveSubjekt) — subjectsOnly itself is read fresh inside the
    // closure each time it fires, so a *new* fetch must reflect the new flag.
    rerender({ so: false });
    act(() => { result.current.widenToUniversity(); }); // force a fresh fetch deterministically
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.sections.find(s => s.key === 'people')?.results.length).toBe(1));
  });
});
