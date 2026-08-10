import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('shows the Stránky IS segment active by default with the shortcut grid', () => {
    render(<StudentScreen />);
    expect(screen.getByRole('tab', { name: 'Stránky IS' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Lidé' })).toHaveAttribute('aria-selected', 'false');
    // Eduroam is deliberately absent: one-time device setup belongs in settings,
    // not among the everyday shortcuts. It lives in ProfileSheet now.
    expect(screen.queryByText('Eduroam')).not.toBeInTheDocument();
    expect(screen.getByText('Dokumenty')).toBeInTheDocument();
    expect(screen.getByText('ISKAM')).toBeInTheDocument();
    // Erasmus is gone from the phone entirely: it hosted the desktop panel
    // wholesale, whose Learning Agreement tables and Europe map do not survive
    // a narrow screen, and it offered every student a shortcut to something
    // only exchange students use. It stays on desktop.
    expect(screen.queryByText('Erasmus')).not.toBeInTheDocument();
  });

  it('pushes a docs sheet when the Dokumenty shortcut is tapped', () => {
    render(<StudentScreen />);
    fireEvent.click(screen.getByText('Dokumenty'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'docs' }]);
  });

  it('renders the ISKAM shortcut as a real link, not a sheet trigger', () => {
    render(<StudentScreen />);
    const link = screen.getByRole('link', { name: /ISKAM/ });
    expect(link).toHaveAttribute('href', 'https://webiskam.mendelu.cz/');
    fireEvent.click(link);
    expect(useAppStore.getState().mobileSheets).toEqual([]);
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

  it('does not show the shortcut grid once switched to Lidé', () => {
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));
    expect(screen.queryByText('Eduroam')).not.toBeInTheDocument();
  });

  it('filters IS pages as the user types', () => {
    render(<StudentScreen />);
    const input = screen.getByRole('textbox', { name: 'Hledej stránku v IS…' });
    fireEvent.change(input, { target: { value: 'Portál studenta' } });
    expect(screen.getByText('Portál studenta')).toBeInTheDocument();
    expect(screen.queryByText('E-index')).not.toBeInTheDocument();
  });

  it('shows the no-results message for a query with no matches', () => {
    render(<StudentScreen />);
    const input = screen.getByRole('textbox', { name: 'Hledej stránku v IS…' });
    fireEvent.change(input, { target: { value: 'zzzznonexistentpage' } });
    expect(screen.getByText('Nic jsme nenašli. Zkus to jinak.')).toBeInTheDocument();
  });
});

describe('StudentScreen — the IS page directory', () => {
  // 95 links across 13 categories, including IS's own administration,
  // documentation and personalisation sections. Listed outright they buried
  // the two shortcuts a student opens daily and made the tab read as a site
  // map. They are kept, behind one row.
  it('keeps the page list collapsed until asked for', () => {
    render(<StudentScreen />);
    expect(screen.queryByText('E-index')).not.toBeInTheDocument();
    expect(screen.getByText('Všechny stránky IS')).toBeInTheDocument();
  });

  it('reveals the list when the row is tapped, and hides it again', () => {
    render(<StudentScreen />);
    const row = screen.getByRole('button', { name: /Všechny stránky IS/ });

    fireEvent.click(row);
    expect(screen.getByText('E-index')).toBeInTheDocument();
    expect(row).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(row);
    expect(screen.queryByText('E-index')).not.toBeInTheDocument();
  });

  it('searching reaches every page without expanding anything', () => {
    // This is what makes hiding the long tail safe: the box above is a
    // complete index of it, collapsed or not.
    render(<StudentScreen />);
    const input = screen.getByRole('textbox', { name: 'Hledej stránku v IS…' });
    fireEvent.change(input, { target: { value: 'E-index' } });
    expect(screen.getByText('E-index')).toBeInTheDocument();
  });
});
