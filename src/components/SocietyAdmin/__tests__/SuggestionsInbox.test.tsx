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

  it('marks a suggestion done through the store', () => {
    const updateSuggestionStatus = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ suggestions: [row], suggestionsUnread: 1, updateSuggestionStatus });
    render(<SuggestionsInbox />);
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));
    expect(updateSuggestionStatus).toHaveBeenCalledWith(1, 'done');
  });
});
