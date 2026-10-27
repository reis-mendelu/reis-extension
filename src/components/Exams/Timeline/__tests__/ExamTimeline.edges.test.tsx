import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ExamTimeline from '../ExamTimeline';
import { useAppStore } from '../../../../store/useAppStore';

const exam = (id: string, date: string) => ({
  term: { id, date, time: '09:00' },
  subjectName: `Předmět ${id}`,
});

/**
 * The extension's horizontal exam timeline hides its scrollbar, so a mouse
 * could not reach the exams past the window's edge — the gap the phone's
 * registered strip had on a Mac, with the same answer: edge buttons while it
 * overflows (EdgeScrollButtons), and the wheel left to the browser.
 */
describe('ExamTimeline and a mouse', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', isTouch: false } as never));

  it('offers a forward button while the horizontal timeline overflows', () => {
    const { container } = render(
      <ExamTimeline
        exams={[exam('1', '1.6.2026'), exam('2', '2.6.2026'), exam('3', '3.6.2026')]}
        orientation="horizontal"
      />
    );
    const scroller = container.querySelector('.overflow-x-auto') as HTMLElement;
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 600 });
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as never;
    act(() => {
      fireEvent.scroll(scroller);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Posunout dál' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 480, behavior: 'smooth' });
    const wheel = new WheelEvent('wheel', { deltaY: 60, bubbles: true, cancelable: true });
    scroller.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
  });
});
