import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { FeedbackModal } from '../FeedbackModal';

vi.mock('../../../api/suggestions', () => ({ submitSuggestion: vi.fn() }));

/**
 * Opening the form focuses no field, on any device. The student has not yet
 * chosen Chyba, Nápad or Jiné, so a cursor in a text field presumes the next
 * step. On the Pixel 9a it also raised the soft keyboard while the sheet was
 * still sliding in, the WebView resized under it, and the sheet jumped.
 */
describe('FeedbackModal initial focus', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en' });
  });

  const expectNoFieldFocused = () => {
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText(/Briefly describe/i));
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText(/What happened/i));
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText(/Email/i));
  };

  it.each([
    ['a phone', { isTouch: true, isNarrow: true }],
    ['an iPad', { isTouch: true, isNarrow: false }],
    ['desktop', { isTouch: false, isNarrow: false }],
  ])('focuses no field on %s, empty or prefilled', (_, viewport) => {
    useAppStore.setState(viewport);
    const { unmount } = render(<FeedbackModal isOpen onClose={vi.fn()} />);
    expectNoFieldFocused();
    unmount();
    render(<FeedbackModal isOpen onClose={vi.fn()} initialTitle="Chybí zkouška" />);
    expectNoFieldFocused();
  });
});
