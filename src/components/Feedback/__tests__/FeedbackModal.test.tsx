import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModal } from '../FeedbackModal';

const submitSuggestion = vi.fn();
vi.mock('../../../api/suggestions', () => ({
  submitSuggestion: (...args: unknown[]) => submitSuggestion(...args),
}));

describe('FeedbackModal', () => {
  beforeEach(() => {
    submitSuggestion.mockReset();
    submitSuggestion.mockResolvedValue({ ok: true });
    useAppStore.setState({ language: 'en' });
  });

  it('submits the draft through submitSuggestion, not a webhook', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), {
      target: { value: 'Exams empty' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), {
      target: { value: 'Panel stayed empty' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));

    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion).toHaveBeenCalledWith({
      type: 'bug',
      title: 'Exams empty',
      body: 'Panel stayed empty',
      contact: '',
    });
  });

  it('shows the success state when the submission lands', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), {
      target: { value: 'T' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), {
      target: { value: 'B' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));
    expect(await screen.findByText('Sent!')).toBeInTheDocument();
  });

  it('stays on the form when the submission fails', async () => {
    submitSuggestion.mockResolvedValue({ ok: false, error: 'rate_limited' });
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), {
      target: { value: 'T' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), {
      target: { value: 'B' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalled());
    expect(screen.queryByText('Sent!')).not.toBeInTheDocument();
  });
});
