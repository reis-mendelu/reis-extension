import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModalHost } from '../FeedbackModalHost';

vi.mock('../../../api/suggestions', () => ({ submitSuggestion: vi.fn() }));

beforeEach(() => {
  useAppStore.setState({ language: 'en', reportOpen: false, reportPrefill: null });
});
afterEach(cleanup);

describe('FeedbackModalHost', () => {
  it('renders nothing while closed', () => {
    render(<FeedbackModalHost />);
    expect(screen.queryByPlaceholderText(/Briefly describe/i)).toBeNull();
  });

  it('opens with the prefilled title as a bug', () => {
    render(<FeedbackModalHost />);
    act(() => useAppStore.getState().openReport({ title: 'Exams: list is empty' }));
    expect(screen.getByPlaceholderText(/Briefly describe/i)).toHaveValue('Exams: list is empty');
    expect(screen.getByRole('button', { name: /Bug/ })).toHaveClass('bg-error/20');
  });

  it('starts fresh on the next open instead of keeping the last prefill', () => {
    render(<FeedbackModalHost />);
    act(() => useAppStore.getState().openReport({ title: 'Exams: list is empty' }));
    act(() => useAppStore.getState().closeReport());
    act(() => useAppStore.getState().openReport());
    expect(screen.getByPlaceholderText(/Briefly describe/i)).toHaveValue('');
  });

  it('closing the form closes the store state', () => {
    render(<FeedbackModalHost />);
    act(() => useAppStore.getState().openReport());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(useAppStore.getState().reportOpen).toBe(false);
  });
});
