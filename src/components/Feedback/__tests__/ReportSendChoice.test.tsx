import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModal } from '../FeedbackModal';

// How a report is sent: a Chyba through two buttons (with or without the
// log), a Nápad or Jiné through one. Attachment handling itself is in
// ReportAttachments.test.tsx.

const submitSuggestion = vi.fn();
vi.mock('../../../api/suggestions', () => ({
  submitSuggestion: (...args: unknown[]) => submitSuggestion(...args),
}));

const collectDiagnostics = vi.fn();
vi.mock('../../../utils/diagnostics/collectDiagnostics', () => ({
  collectDiagnostics: () => collectDiagnostics(),
}));

const requestDataConsent = vi.fn();
vi.mock('../../../utils/firefoxDataConsent', async (orig) => ({
  ...(await orig<typeof import('../../../utils/firefoxDataConsent')>()),
  requestDataConsent: (c: unknown) => requestDataConsent(c),
}));

function fill() {
  fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), { target: { value: 'T' } });
  fireEvent.change(screen.getByPlaceholderText(/What happened/i), { target: { value: 'B' } });
}

function fillAndSend(button: RegExp) {
  fill();
  fireEvent.click(screen.getByRole('button', { name: button }));
}

const pickIdea = () => fireEvent.click(screen.getByRole('button', { name: /Idea/i }));

describe('report send buttons', () => {
  beforeEach(() => {
    submitSuggestion.mockReset().mockResolvedValue({ ok: true });
    requestDataConsent.mockReset().mockResolvedValue(true);
    collectDiagnostics
      .mockReset()
      .mockResolvedValue({ entries: [], env: { os: 'macOS' }, sync: {} });
    useAppStore.setState({ language: 'en' });
  });

  // A Chyba makes the student choose: a pre-ticked box is not consent
  // (CJEU Planet49, C-673/17), so the log goes only with the button that says so.
  it('a Chyba has no checkbox, and two Send buttons with the log first', () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    expect(screen.queryByRole('checkbox', { name: /Attach technical details/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Send feedback/i })).toBeNull();
    const [first, second] = screen.getAllByRole('button', { name: /^Send with|^Send without/i });
    expect(first).toHaveTextContent(/Send with technical details/i);
    expect(first).toHaveClass('btn-primary');
    expect(second).toHaveTextContent(/Send without them/i);
    expect(second).not.toHaveClass('btn-primary');
    // What the log holds is said next to the choice, not hidden.
    expect(screen.getByText(/without links, emails/i)).toBeInTheDocument();
  });

  it('a Chyba sent with technical details carries the log and asks Firefox for it', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fillAndSend(/Send with technical details/i);
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(collectDiagnostics).toHaveBeenCalledTimes(1);
    expect(submitSuggestion.mock.calls[0]![1].diagnostics.env.os).toBe('macOS');
    expect(requestDataConsent).toHaveBeenCalledWith([
      'personalCommunications',
      'technicalAndInteraction',
    ]);
  });

  it('a Chyba sent without them carries no log and collects none', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fillAndSend(/Send without them/i);
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion.mock.calls[0]![1].diagnostics).toBeNull();
    expect(collectDiagnostics).not.toHaveBeenCalled();
    expect(requestDataConsent).toHaveBeenCalledWith(['personalCommunications']);
  });

  it('a Nápad ticked and then switched to Chyba sends the log only by the button', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    pickIdea();
    fireEvent.click(screen.getByRole('checkbox', { name: /Attach technical details/i }));
    fireEvent.click(screen.getByRole('button', { name: /Bug/i }));
    fillAndSend(/Send without them/i);
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion.mock.calls[0]![1].diagnostics).toBeNull();
  });

  it('Enter does not send a Chyba: the student picks a button', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fill();
    fireEvent.keyDown(screen.getByPlaceholderText(/Briefly describe/i), { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 0));
    expect(requestDataConsent).not.toHaveBeenCalled();
    expect(submitSuggestion).not.toHaveBeenCalled();
  });

  // Reviewer-reported (Greptile, #569): Enter calls the send without a button
  // press, and the spinner was tied to the pressed button, so a keyboard send
  // showed a disabled button and no sign the report was on its way.
  it('a Nápad sent with Enter shows that it is sending', async () => {
    submitSuggestion.mockReturnValue(new Promise(() => {}));
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    pickIdea();
    fill();
    fireEvent.keyDown(screen.getByPlaceholderText(/Briefly describe/i), { key: 'Enter' });
    expect(await screen.findByRole('button', { name: /Sending/i })).toBeDisabled();
  });
});
