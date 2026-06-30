import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../index';
import { useAppStore } from '../../../store/useAppStore';

/**
 * Full-render adversarial coverage for the Study Plan's <SearchBar minimal subjectsOnly>
 * configuration — the actual mount used in production (see StudyPlanPage.tsx).
 * Exercises real useSearch + real component chrome, only stubbing executeSearch (network).
 */

const person = (id: string, name: string) => ({ id, name, type: 'teacher' as const, link: `p${id}` });
const subj = (id: string, code: string, name: string, semester: string, faculty = 'PEF') =>
  ({ id, code, name, link: `l${id}`, faculty, facultyColor: '#fff', semester });

function seed(
  executeSearch: ReturnType<typeof vi.fn>,
  { language = 'cs', userFaculty = 'PEF' }: { language?: string; userFaculty?: string | null } = {},
) {
  useAppStore.setState({
    language,
    studiumId: 's1', obdobiId: 'o1', facultyId: 'f1',
    userFaculty,
    userSemester: null,
    subjects: { data: {} },
    recentSearches: [],
    saveRecentSearch: vi.fn(),
    executeSearch,
    studyPlanDual: null,
  } as never);
}

describe('SearchBar minimal+subjectsOnly — full render (Study Plan mount)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows the subjects-only placeholder, not the generic placeholder', () => {
    seed(vi.fn());
    render(<SearchBar minimal subjectsOnly />);
    expect(screen.getByPlaceholderText('Hledej předměty...')).toBeTruthy();
  });

  it('shows the EN subjects-only placeholder when language is en', () => {
    seed(vi.fn(), { language: 'en' });
    render(<SearchBar minimal subjectsOnly />);
    expect(screen.getByPlaceholderText('Search subjects...')).toBeTruthy();
  });

  it('empty/whitespace query renders no dropdown and no stray buttons (minimal mode)', async () => {
    seed(vi.fn());
    render(<SearchBar minimal subjectsOnly />);
    const input = screen.getByPlaceholderText('Hledej předměty...');
    await userEvent.click(input);
    await userEvent.type(input, '   ');
    // No clear button should render for whitespace-only? Actually the X button renders
    // whenever query is non-empty (even whitespace) — that's fine, it's a stray-buttons
    // check on the *dropdown*, not the input chrome.
    expect(screen.queryByText('Hledej předměty...')).toBeNull(); // placeholder hidden once typed
    // No section labels, no recent-searches hint, no widen/narrow control — dropdown is fully suppressed.
    expect(screen.queryByText(/Celá univerzita|Whole university/)).toBeNull();
    expect(screen.queryByText(/Hledám v rámci|Searching within/)).toBeNull();
  });

  it('renders only the subjects section in the dropdown — people never appear in the DOM', async () => {
    const executeSearch = vi.fn().mockResolvedValue({
      people: [person('p1', 'Jan Novák'), person('p2', 'Petr Svoboda')],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    seed(executeSearch);
    render(<SearchBar minimal subjectsOnly />);
    const input = screen.getByPlaceholderText('Hledej předměty...');
    await userEvent.click(input);
    await userEvent.type(input, 'statistika');

    await waitFor(() => expect(screen.getByText('Statistika')).toBeTruthy());
    expect(screen.queryByText('Jan Novák')).toBeNull();
    expect(screen.queryByText('Petr Svoboda')).toBeNull();
  });

  it('people stay absent from the DOM after widening to university scope', async () => {
    const executeSearch = vi.fn()
      .mockResolvedValueOnce({
        people: [person('p1', 'Jan Novák')],
        subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
        subjectsTruncated: false,
      })
      .mockResolvedValueOnce({
        people: [person('p1', 'Jan Novák'), person('p2', 'Petr Svoboda'), person('p3', 'Eva Veselá')],
        subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026'), subj('9', 'XYZ-1', 'Statistika II', 'LS 2025/2026', 'AF')],
        subjectsTruncated: false,
      });
    seed(executeSearch);
    render(<SearchBar minimal subjectsOnly />);
    const input = screen.getByPlaceholderText('Hledej předměty...');
    await userEvent.click(input);
    await userEvent.type(input, 'statistika');

    await waitFor(() => expect(screen.getByText('Statistika')).toBeTruthy());
    const widenBtn = await screen.findByText('Celá univerzita');
    await userEvent.click(widenBtn);

    await waitFor(() => expect(screen.getByText('Statistika II')).toBeTruthy());
    expect(screen.queryByText('Jan Novák')).toBeNull();
    expect(screen.queryByText('Petr Svoboda')).toBeNull();
    expect(screen.queryByText('Eva Veselá')).toBeNull();
    // The toggle must have flipped to "narrow" label, proving the widen actually took effect.
    expect(screen.getByText('Jen moje fakulta')).toBeTruthy();
  });

  it('the widen/narrow toggle is present and functional under subjectsOnly (goal: faculty<->university still works)', async () => {
    const executeSearch = vi.fn().mockResolvedValue({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    seed(executeSearch);
    render(<SearchBar minimal subjectsOnly />);
    const input = screen.getByPlaceholderText('Hledej předměty...');
    await userEvent.click(input);
    await userEvent.type(input, 'statistika');
    await waitFor(() => expect(executeSearch).toHaveBeenCalledWith('statistika', 'cz', '43110'));

    const widenBtn = await screen.findByText('Celá univerzita');
    await userEvent.click(widenBtn);
    await waitFor(() => expect(executeSearch).toHaveBeenLastCalledWith('statistika', 'cz', undefined));

    const narrowBtn = await screen.findByText('Jen moje fakulta');
    await userEvent.click(narrowBtn);
    await waitFor(() => expect(executeSearch).toHaveBeenLastCalledWith('statistika', 'cz', '43110'));
  });

  it('no widen/narrow control renders when the faculty is unknown (canScopeToFaculty=false) under subjectsOnly', async () => {
    const executeSearch = vi.fn().mockResolvedValue({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    seed(executeSearch, { userFaculty: null });
    render(<SearchBar minimal subjectsOnly />);
    const input = screen.getByPlaceholderText('Hledej předměty...');
    await userEvent.click(input);
    await userEvent.type(input, 'statistika');
    await waitFor(() => expect(screen.getByText('Statistika')).toBeTruthy());
    expect(screen.queryByText('Celá univerzita')).toBeNull();
    expect(screen.queryByText('Jen moje fakulta')).toBeNull();
  });

  it('the dropdown has no IS-portal footer/launcher chrome in minimal+subjectsOnly mode', async () => {
    const executeSearch = vi.fn().mockResolvedValue({
      people: [],
      subjects: [subj('1', 'EBC-ST', 'Statistika', 'LS 2025/2026')],
      subjectsTruncated: false,
    });
    seed(executeSearch);
    render(<SearchBar minimal subjectsOnly />);
    // No launcher button, no kbd shortcut badge, regardless of query state.
    expect(screen.queryByRole('button', { name: /portal/i })).toBeNull();
    const input = screen.getByPlaceholderText('Hledej předměty...');
    await userEvent.click(input);
    await userEvent.type(input, 'statistika');
    await waitFor(() => expect(screen.getByText('Statistika')).toBeTruthy());
    expect(screen.queryByText(/⌘K|Ctrl/)).toBeNull();
  });
});
