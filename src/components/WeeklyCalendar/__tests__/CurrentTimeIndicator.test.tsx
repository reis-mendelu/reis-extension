import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { CurrentTimeIndicator } from '../CurrentTimeIndicator';

/**
 * The "now" line is positioned by column index, so it has to divide the grid by
 * the number of columns actually drawn. It used to divide by a literal 5, which
 * put the line in the wrong column the moment the grid grew a Saturday for a
 * combined-study week — and hid it outright on the Saturday itself.
 */
describe('CurrentTimeIndicator', () => {
  const at = (h: number) => new Date(2026, 8, 21, h, 0, 0); // Mon 21 Sep 2026

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const leftOf = (dayCount: number, todayIndex: number, hour = 10) => {
    vi.setSystemTime(at(hour));
    const { container } = render(
      <CurrentTimeIndicator todayIndex={todayIndex} dayCount={dayCount} />
    );
    const el = container.firstElementChild as HTMLElement | null;
    return el ? { left: el.style.left, width: el.style.width } : null;
  };

  it('splits a five-column week into fifths', () => {
    expect(leftOf(5, 0)).toEqual({ left: '0%', width: '20%' });
    expect(leftOf(5, 4)).toEqual({ left: '80%', width: '20%' });
  });

  it('splits a six-column week into sixths, not fifths', () => {
    const { left, width } = leftOf(6, 3)!;
    expect(width).toBe(`${100 / 6}%`);
    expect(left).toBe(`${(100 / 6) * 3}%`);
  });

  it('draws on the Saturday itself when Saturday is a visible column', () => {
    expect(leftOf(6, 5)).not.toBeNull();
  });

  it('draws nothing when today is outside the visible columns', () => {
    // Sunday (index 6) in an ordinary five-column week — the old `> 4` guard
    // happened to cover this, and it still has to.
    expect(leftOf(5, 6)).toBeNull();
    expect(leftOf(6, 6)).toBeNull();
  });

  // The cleanup was returned from inside the setTimeout callback, where React
  // never sees it, so the once-a-minute interval outlived the component and kept
  // calling setNow on an unmounted tree.
  it('clears its minute interval when the calendar unmounts', () => {
    vi.setSystemTime(at(10));
    const { unmount } = render(<CurrentTimeIndicator todayIndex={0} dayCount={5} />);

    // Cross the first minute boundary so the interval is actually created.
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount(), 'a timer survived unmount').toBe(0);
  });

  it('draws nothing outside grid hours or when today is not in this week', () => {
    expect(leftOf(5, 0, 6)).toBeNull();
    expect(leftOf(5, 0, 21)).toBeNull();
    expect(leftOf(5, -1)).toBeNull();
  });
});
