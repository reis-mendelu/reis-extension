import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModal } from '../FeedbackModal';

vi.mock('../../../api/suggestions', () => ({ submitSuggestion: vi.fn() }));

/**
 * Opening the form must not raise a soft keyboard. On the Pixel 9a the
 * keyboard came up while the sheet was still sliding in, the WebView resized
 * under it, and the sheet visibly jumped two or three times. A hardware
 * keyboard has no such cost, so the extension keeps its focused field.
 */
describe('FeedbackModal initial focus', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en' });
  });

  const title = () => screen.getByPlaceholderText(/Briefly describe/i);
  const message = () => screen.getByPlaceholderText(/What happened/i);

  it('focuses nothing on a phone', () => {
    useAppStore.setState({ isTouch: true, isNarrow: true });
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    expect(document.activeElement).not.toBe(title());
    expect(document.activeElement).not.toBe(message());
  });

  it('focuses nothing on an iPad, which gets the centred dialog but a soft keyboard', () => {
    useAppStore.setState({ isTouch: true, isNarrow: false });
    render(<FeedbackModal isOpen onClose={vi.fn()} initialTitle="Chybí zkouška" />);
    expect(document.activeElement).not.toBe(title());
    expect(document.activeElement).not.toBe(message());
  });

  it('focuses the title on desktop when it is empty', () => {
    useAppStore.setState({ isTouch: false, isNarrow: false });
    render(<FeedbackModal isOpen onClose={vi.fn()} />);
    expect(document.activeElement).toBe(title());
  });

  it('focuses the message on desktop when the title arrives prefilled', () => {
    useAppStore.setState({ isTouch: false, isNarrow: false });
    render(<FeedbackModal isOpen onClose={vi.fn()} initialTitle="Chybí zkouška" />);
    expect(document.activeElement).toBe(message());
  });
});
