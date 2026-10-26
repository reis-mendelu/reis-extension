import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ExamTimeline from '../ExamTimeline';

const exam = (id: string, date: string) => ({
  term: { id, date, time: '09:00' },
  subjectName: `Předmět ${id}`,
});

/**
 * The extension's horizontal exam timeline hides its scrollbar, so in a
 * desktop browser a plain mouse wheel could not reach the exams past the
 * window's edge. The same gap the phone's registered strip had on a Mac
 * (RegisteredStrip), answered the same way: a vertical wheel scrolls it
 * sideways, pixel for pixel, since this one does not snap.
 */
describe('ExamTimeline and a mouse wheel', () => {
  it('scrolls the horizontal timeline sideways', () => {
    const { container } = render(
      <ExamTimeline
        exams={[exam('1', '1.6.2026'), exam('2', '2.6.2026'), exam('3', '3.6.2026')]}
        orientation="horizontal"
      />
    );
    const scroller = container.firstElementChild as HTMLElement;
    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 2000 });
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 600 });
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as never;
    const notch = new WheelEvent('wheel', { deltaY: 60, bubbles: true, cancelable: true });
    scroller.dispatchEvent(notch);
    expect(notch.defaultPrevented).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({ left: 60 });
  });
});
