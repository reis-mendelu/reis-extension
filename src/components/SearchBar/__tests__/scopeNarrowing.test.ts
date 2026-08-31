/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSearch } from '../useSearch';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

vi.mock('../../../store/useAppStore', () => ({ useAppStore: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: vi.fn() }));

const mockExecuteSearch = vi.fn();

function setup({
  language = 'cz',
  userFaculty = 'PEF' as string | null,
  subjectsData = {} as Record<string, any>,
} = {}) {
  const state: any = {
    subjects: { data: subjectsData },
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

const subj = (id: string, code: string, name: string, faculty = 'PEF') => ({
  id,
  code,
  name,
  link: `l${id}`,
  faculty,
  facultyColor: '#fff',
  semester: 'ZS 2025/2026',
});

/**
 * Narrowing has to actually narrow.
 *
 * The network results were merged into whatever the section already held, so a
 * student who widened to the whole university and then chose "Jen moje fakulta"
 * kept every other faculty's subject on screen under a label promising their
 * own faculty only. The instant, locally-derived enrolled rows are a different
 * matter — those are not a search result and must survive.
 */
describe('useSearch — narrowing back to the faculty drops the wider results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forgets subjects fetched under the university-wide scope', async () => {
    setup();
    mockExecuteSearch.mockResolvedValueOnce({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistika')],
      subjectsTruncated: false,
    });

    const { result } = renderHook(() => useSearch('statistika'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(1));

    // Widen: the university answer carries another faculty's subject.
    mockExecuteSearch.mockResolvedValueOnce({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistika'), subj('9', 'XYZ-ST', 'Statistika II', 'AF')],
      subjectsTruncated: false,
    });
    act(() => result.current.widenToUniversity());
    await waitFor(() =>
      expect(result.current.sections.find((s) => s.key === 'subjects')?.results.length).toBe(2)
    );

    // Narrow: IS answers with the student's faculty only, and so must the list.
    mockExecuteSearch.mockResolvedValueOnce({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistika')],
      subjectsTruncated: false,
    });
    act(() => result.current.narrowToFaculty());
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(3));

    await waitFor(() => {
      const codes = result.current.sections
        .find((s) => s.key === 'subjects')
        ?.results.map((r) => r.subjectCode);
      expect(codes).toEqual(['EBC-ST']);
    });
  });
  /**
   * Narrowing has to bite on the tap, not when the answer lands.
   *
   * The refetch is debounced by 250 ms and then still has to reach IS. Dropping
   * the wider rows only in the response handler left every other faculty's
   * subject on screen for that whole interval — under a scope control that had
   * already flipped to "widen to the whole university", i.e. already claiming
   * the narrow scope the list was not yet showing. The enrolled rows are the
   * exception, as everywhere else in this hook: they are derived locally from
   * the student's own subjects, not from the answer being replaced.
   */
  it('drops the university-wide rows on the tap, before the refetch resolves', async () => {
    setup({
      subjectsData: {
        'EBC-ST': {
          displayName: 'Statistika',
          nameCs: 'Statistika',
          nameEn: 'Statistics',
          subjectId: '1',
        },
      },
    });
    mockExecuteSearch.mockResolvedValueOnce({
      people: [],
      subjects: [],
      subjectsTruncated: false,
    });

    const { result } = renderHook(() => useSearch('statistika'));
    await waitFor(() => expect(mockExecuteSearch).toHaveBeenCalledTimes(1));

    mockExecuteSearch.mockResolvedValueOnce({
      people: [],
      subjects: [subj('9', 'XYZ-ST', 'Statistika II', 'AF')],
      subjectsTruncated: false,
    });
    act(() => result.current.widenToUniversity());
    await waitFor(() =>
      expect(
        result.current.sections.find((s) => s.key === 'subjects')?.results.map((r) => r.subjectCode)
      ).toEqual(['EBC-ST', 'XYZ-ST'])
    );

    // The tap itself. No timers advanced, no response delivered.
    mockExecuteSearch.mockResolvedValueOnce({
      people: [],
      subjects: [],
      subjectsTruncated: false,
    });
    act(() => result.current.narrowToFaculty());

    expect(
      result.current.sections.find((s) => s.key === 'subjects')?.results.map((r) => r.subjectCode)
    ).toEqual(['EBC-ST']);
  });
});
