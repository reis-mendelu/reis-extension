import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModal } from '../FeedbackModal';

const submitSuggestion = vi.fn();
vi.mock('../../../api/suggestions', () => ({
  submitSuggestion: (...args: unknown[]) => submitSuggestion(...args),
}));

describe('FeedbackModal', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    submitSuggestion.mockReset();
    submitSuggestion.mockResolvedValue({ ok: true });
    useAppStore.setState({ language: 'en' });
    // Guards against a merge/copy-paste mistake that leaves a stray direct
    // fetch() alongside submitSuggestion — all network I/O must go through
    // the API layer, never straight out of the component.
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it('enforces the edge function limits client-side via maxLength', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Briefly describe/i)).toHaveAttribute('maxLength', '120');
    expect(screen.getByPlaceholderText(/What happened/i)).toHaveAttribute('maxLength', '2000');
  });

  // Reviewer-reported (CodeRabbit): the Send button's `disabled` was the only
  // validation, but Enter in the title/contact fields calls handleSubmit
  // directly. A half-filled form then posted, the function 400'd it, and the
  // student got the generic failure toast for input the UI should have caught.
  it('does not submit on Enter when the message is empty', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    const titleInput = screen.getByPlaceholderText(/Briefly describe/i);
    fireEvent.change(titleInput, { target: { value: 'T' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });
    expect(submitSuggestion).not.toHaveBeenCalled();
  });

  it('treats whitespace-only input as empty', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    const titleInput = screen.getByPlaceholderText(/Briefly describe/i);
    fireEvent.change(titleInput, { target: { value: '   ' } });
    fireEvent.change(screen.getByPlaceholderText(/What happened/i), {
      target: { value: '   ' },
    });
    fireEvent.keyDown(titleInput, { key: 'Enter' });
    expect(submitSuggestion).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Send feedback/i })).toBeDisabled();
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
