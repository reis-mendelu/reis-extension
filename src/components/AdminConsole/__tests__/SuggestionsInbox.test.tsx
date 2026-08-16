import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SuggestionsInbox } from '../SuggestionsInbox';
import type { SuggestionRow } from '../../../types/suggestions';

const row: SuggestionRow = {
  id: 1,
  type: 'bug',
  title: 'Exams empty',
  body: 'Panel stayed empty after enrolling',
  contact: 'student@mendelu.cz',
  screen: 'exams',
  ext_version: '4.0.0',
  browser_name: 'Chrome',
  browser_version: '131',
  viewport: '390x844',
  status: 'new',
  created_at: '2026-08-01T00:00:00.000Z',
};

describe('SuggestionsInbox', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en', suggestions: [], suggestionsUnread: 0 });
  });

  it('shows an empty state when there is nothing', () => {
    render(<SuggestionsInbox />);
    expect(screen.getByText(/No suggestions yet/i)).toBeInTheDocument();
  });

  it('renders a suggestion with its screen and contact', () => {
    useAppStore.setState({ suggestions: [row], suggestionsUnread: 1 });
    render(<SuggestionsInbox />);
    expect(screen.getByText('Exams empty')).toBeInTheDocument();
    expect(screen.getByText(/exams/)).toBeInTheDocument();
    expect(screen.getByText('student@mendelu.cz')).toBeInTheDocument();
  });

  // jsdom has no layout, so the wrap itself cannot be asserted here — it was
  // measured in a real browser (title span scrollWidth 1250 → 239 at 320px).
  // This pins the class that makes it possible: without min-w-0 the flex item's
  // default min-width:auto holds it at the width of an unbreakable title and
  // the row scrolls sideways, pushing the type badge off screen.
  it('lets the title shrink so a long unbroken title can wrap', () => {
    useAppStore.setState({ suggestions: [{ ...row, title: 'A'.repeat(120) }] });
    render(<SuggestionsInbox />);
    expect(screen.getByText('A'.repeat(120))).toHaveClass('min-w-0', 'break-words');
  });

  it('marks a suggestion done through the store', () => {
    const updateSuggestionStatus = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ suggestions: [row], suggestionsUnread: 1, updateSuggestionStatus });
    render(<SuggestionsInbox />);
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(updateSuggestionStatus).toHaveBeenCalledWith(1, 'done');
  });
});
