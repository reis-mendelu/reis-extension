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

  const subj = (id: string, code: string, name: string, semester: string, faculty = 'PEF') =>
    ({ id, code, name, link: `l${id}`, faculty, facultyColor: '#fff', semester });

  it('collapses same-code subjects across semesters to the latest one', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'ZS 2025/2026'), subj('2', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('statistika'));
    await waitFor(() => expect(result.current.sections.find(s => s.key === 'subjects')?.results.length).toBe(1));
    expect(result.current.sections.find(s => s.key === 'subjects')!.results[0].semester).toBe('LS 2025/2026');
  });

  it('omits the people section when subjectsOnly is set', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [{ id: 'p1', name: 'Jan Novák', type: 'teacher', link: 'x' }],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('statistika', true));
    await waitFor(() => expect(result.current.sections.find(s => s.key === 'subjects')?.results.length).toBe(1));
    expect(result.current.sections.find(s => s.key === 'people')).toBeUndefined();
  });

  it('keeps the people section by default (subjectsOnly off)', async () => {
    setup({ language: 'cz', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [{ id: 'p1', name: 'Jan Novák', type: 'teacher', link: 'x' }],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('statistika'));
    await waitFor(() => expect(result.current.sections.find(s => s.key === 'people')?.results.length).toBe(1));
  });

  it('ranks the English-taught (v AJ) variant first in EN mode', async () => {
    setup({ language: 'en', userFaculty: 'PEF' });
    mockExecuteSearch.mockResolvedValue({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistics', 'SS 2025/2026', 'FBE'), subj('2', 'EBA-ST', 'Statistics', 'SS 2025/2026', 'FBE')],
      subjectsTruncated: false,
    });
    const { result } = renderHook(() => useSearch('statistics'));
    await waitFor(() => expect(result.current.sections.find(s => s.key === 'subjects')?.results.length).toBe(2));
    const subjects = result.current.sections.find(s => s.key === 'subjects')!.results;
    expect(subjects[0].subjectCode).toBe('EBA-ST');
    expect(subjects[0].isEnglishVariant).toBe(true);
  });
});
