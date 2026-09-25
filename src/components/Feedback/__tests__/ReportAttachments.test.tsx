import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModal } from '../FeedbackModal';

const submitSuggestion = vi.fn();
vi.mock('../../../api/suggestions', () => ({
  submitSuggestion: (...args: unknown[]) => submitSuggestion(...args),
}));

const payload = {
  entries: [
    { t: 1, level: 'error', source: 'content', ctx: 'Api.fetchExams', status: 503, msg: 'boom' },
    { t: 2, level: 'warn', source: 'app', ctx: null, msg: 'careful' },
  ],
  env: { platform: 'extension', os: 'macOS', lang: 'en', online: true, uptimeS: 10 },
  sync: {
    lastSync: null,
    isSyncing: false,
    schedule: 'success',
    exams: 'error',
    scheduleCount: 1,
    examsCount: 0,
    examsFetchedAt: null,
  },
};
const collectDiagnostics = vi.fn();
vi.mock('../../../utils/diagnostics/collectDiagnostics', () => ({
  collectDiagnostics: () => collectDiagnostics(),
}));

const encodeScreenshot = vi.fn();
vi.mock('../../../utils/diagnostics/encodeScreenshot', () => ({
  encodeScreenshot: (f: Blob) => encodeScreenshot(f),
}));

function fillAndSend() {
  fireEvent.change(screen.getByPlaceholderText(/Briefly describe/i), { target: { value: 'T' } });
  fireEvent.change(screen.getByPlaceholderText(/What happened/i), { target: { value: 'B' } });
  fireEvent.click(screen.getByRole('button', { name: /Send feedback/i }));
}

const png = () => new File(['x'], 'shot.png', { type: 'image/png' });

describe('report attachments', () => {
  beforeEach(() => {
    submitSuggestion.mockReset().mockResolvedValue({ ok: true });
    collectDiagnostics.mockReset().mockResolvedValue(structuredClone(payload));
    encodeScreenshot
      .mockReset()
      .mockResolvedValue({ base64: '/9j/AAAA', bytes: 1234, blob: new Blob(['j']) });
    useAppStore.setState({ language: 'en' });
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('attaches nothing unless the student acts', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: /Attach technical details/i });
    expect(box).not.toBeChecked();
    fillAndSend();
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion.mock.calls[0]![1]).toEqual({
      diagnostics: null,
      screenshotBase64: null,
    });
    expect(collectDiagnostics).not.toHaveBeenCalled();
  });

  it('ticked, sends the collected diagnostics without listing them in the form', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Attach technical details/i }));
    // The log is not shown: students do not read it, and it cost the form height.
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show/i })).not.toBeInTheDocument();
    fillAndSend();
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(collectDiagnostics).toHaveBeenCalledTimes(1);
    const sent = submitSuggestion.mock.calls[0]![1].diagnostics;
    expect(sent.entries.map((e: { msg: string }) => e.msg)).toEqual(['boom', 'careful']);
    expect(sent.env.os).toBe('macOS');
  });

  it('unticking before sending sends no diagnostics and collects none', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: /Attach technical details/i });
    fireEvent.click(box);
    fireEvent.click(box);
    fillAndSend();
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion.mock.calls[0]![1].diagnostics).toBeNull();
    expect(collectDiagnostics).not.toHaveBeenCalled();
  });

  it('attaches a picked screenshot and can remove it', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Attach a screenshot/i), {
      target: { files: [png()] },
    });
    expect(await screen.findByRole('img', { name: /Attached screenshot/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove screenshot/i }));
    expect(screen.queryByRole('img', { name: /Attached screenshot/i })).not.toBeInTheDocument();
    fillAndSend();
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion.mock.calls[0]![1].screenshotBase64).toBeNull();
  });

  it('sends a pasted screenshot', async () => {
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.paste(screen.getByPlaceholderText(/What happened/i), {
      clipboardData: { files: [png()], items: [] },
    });
    await screen.findByRole('img', { name: /Attached screenshot/i });
    fillAndSend();
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion.mock.calls[0]![1].screenshotBase64).toBe('/9j/AAAA');
  });

  it('says so when the image cannot be processed, and sends none', async () => {
    encodeScreenshot.mockResolvedValue(null);
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Attach a screenshot/i), {
      target: { files: [png()] },
    });
    expect(await screen.findByText(/Couldn't process that image/i)).toBeInTheDocument();
    fillAndSend();
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    expect(submitSuggestion.mock.calls[0]![1].screenshotBase64).toBeNull();
  });
});
