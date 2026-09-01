import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StudentScreen } from '../StudentScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { SearchResult } from '../../../SearchBar/types';

function teacher(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: overrides.id ?? '12345',
    title: overrides.title ?? 'Jan Novák',
    type: 'person',
    personType: 'teacher',
    detail: overrides.detail ?? 'Vyučující',
    ...overrides,
  };
}

describe('StudentScreen', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      recentSearches: [],
      recentPeople: [],
      subjects: null,
      studyPlanDual: null,
      studiumId: null,
      userFaculty: null,
      userSemester: null,
      executeSearch: vi
        .fn()
        .mockResolvedValue({ people: [], subjects: [], subjectsTruncated: false }),
    });
  });

  it('opens on Lidé and offers only Lidé and Předměty', () => {
    render(<StudentScreen />);
    expect(screen.getByRole('tab', { name: 'Lidé' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Předměty' })).toHaveAttribute('aria-selected', 'false');
    // The IS page directory is gone from the phone tree: every one of its 95
    // links opened the system browser, which has no IS session. It stays in the
    // browser extension, which sits on IS and keeps the session.
    expect(screen.queryByRole('tab', { name: 'Stránky IS' })).not.toBeInTheDocument();
    expect(screen.queryByText('Všechny stránky IS')).not.toBeInTheDocument();
    // Dokumenty moved to the Profile sheet with eduroam; no shortcut card here.
    expect(screen.queryByText('Dokumenty')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('switching to Lidé shows recently searched people', () => {
    useAppStore.setState({ recentPeople: [teacher()] });
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));
    expect(screen.getByRole('tab', { name: 'Lidé' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Naposledy hledaní')).toBeInTheDocument();
    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
  });

  it('lists recently searched STUDENTS, not only teachers', () => {
    // The list filtered on personType === 'teacher', so a classmate you looked
    // up yesterday was remembered by the store and then thrown away by the
    // screen. Every person you searched belongs here.
    useAppStore.setState({
      recentPeople: [
        { id: '77', title: 'Dominik Holek', type: 'person', personType: 'student' },
        teacher(),
      ],
    });
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));

    expect(screen.getByText('Dominik Holek')).toBeInTheDocument();
    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
  });

  it('shows at most five people, newest first', () => {
    // The store remembers eight; this tab shows five. A phone screen full of
    // old lookups buries the search box under them.
    useAppStore.setState({
      recentPeople: Array.from({ length: 8 }, (_, i) => ({
        id: `p${i}`,
        title: `Osoba ${i}`,
        type: 'person' as const,
        personType: 'student' as const,
      })),
    });
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));

    expect(screen.getByText('Osoba 0')).toBeInTheDocument();
    expect(screen.getByText('Osoba 4')).toBeInTheDocument();
    expect(screen.queryByText('Osoba 5')).not.toBeInTheDocument();
  });

  it('shows nothing at all rather than an empty heading before the first search', () => {
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));
    expect(screen.queryByText('Naposledy hledaní')).not.toBeInTheDocument();
  });
});

describe('StudentScreen — Lidé search while the query is still in flight', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      recentSearches: [],
      recentPeople: [],
      subjects: null,
      studyPlanDual: null,
      studiumId: null,
      userFaculty: null,
      userSemester: null,
      executeSearch: vi
        .fn()
        .mockResolvedValue({ people: [], subjects: [], subjectsTruncated: false }),
    });
  });

  const openPeople = () => {
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));
    return screen.getByRole('textbox');
  };

  // The bug: useSearch debounces 250ms and then goes to the network, so
  // `peopleResults` is [] for the whole round trip. The screen read only
  // `sections` and rendered "Nic jsme nenašli" the instant a query existed —
  // an answer it had not yet earned.
  it('does not claim "nothing found" before the search has answered', async () => {
    const input = openPeople();
    fireEvent.change(input, { target: { value: 'Novák' } });

    expect(screen.queryByText('Nic jsme nenašli. Zkus to jinak.')).not.toBeInTheDocument();
    expect(screen.getByText('Načítání výsledků...')).toBeInTheDocument();
  });

  // A query under useSearch's 2-character floor never reaches the network at
  // all, so "nothing found" was a claim about a search that never ran.
  it('does not claim "nothing found" for a query too short to search', () => {
    const input = openPeople();
    fireEvent.change(input, { target: { value: 'N' } });

    expect(screen.queryByText('Nic jsme nenašli. Zkus to jinak.')).not.toBeInTheDocument();
  });

  // Only once the search has actually answered empty is the message true.
  it('says "nothing found" once the search has answered with nobody', async () => {
    vi.useFakeTimers();
    try {
      const input = openPeople();
      fireEvent.change(input, { target: { value: 'Novák' } });
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.getByText('Nic jsme nenašli. Zkus to jinak.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('StudentScreen — dismissing the iPad keyboard', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      recentSearches: [],
      recentPeople: [],
      subjects: null,
      studyPlanDual: null,
      studiumId: null,
      userFaculty: null,
      userSemester: null,
      executeSearch: vi
        .fn()
        .mockResolvedValue({ people: [], subjects: [], subjectsTruncated: false }),
    });
  });

  // On iPad the software keyboard covers most of the results list. Auto-blurring
  // the moment results arrive would fight anyone still typing, so the dismissal
  // is bound to the three gestures that mean "I'm done typing, let me look":
  // Enter, scrolling the results, and tapping a person.
  it('blurs the input on Enter so the keyboard drops', () => {
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));
    const input = screen.getByRole('textbox');
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).not.toBe(input);
  });

  it('blurs the input when the results list is scrolled', () => {
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));
    const input = screen.getByRole('textbox');
    input.focus();

    fireEvent.scroll(screen.getByTestId('student-results'));
    expect(document.activeElement).not.toBe(input);
  });

  it('marks the input as a search field so iOS shows a Search key', () => {
    render(<StudentScreen />);
    expect(screen.getByRole('textbox')).toHaveAttribute('enterkeyhint', 'search');
  });
});
