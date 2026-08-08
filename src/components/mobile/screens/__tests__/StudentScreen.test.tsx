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

  it('switching to Lidé shows the teacher list', () => {
    useAppStore.setState({ recentSearches: [teacher()] });
    render(<StudentScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Lidé' }));
    expect(screen.getByRole('tab', { name: 'Lidé' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Tvoji vyučující')).toBeInTheDocument();
    expect(screen.getByText('Jan Novák')).toBeInTheDocument();
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
