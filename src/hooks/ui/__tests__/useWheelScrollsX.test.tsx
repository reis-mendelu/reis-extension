import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { useWheelScrollsX } from '../useWheelScrollsX';

function Strip({ mode }: { mode?: 'tile' | 'pixel' }) {
  const ref = useRef<HTMLDivElement>(null);
  useWheelScrollsX(ref, { mode });
  return (
    <div ref={ref} data-testid="strip">
      <button type="button">A</button>
      <button type="button">B</button>
    </div>
  );
}

/** A strip 300px wide holding 900px of tiles, scrolled to `left`. */
function shape(el: HTMLElement, left: number) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 900 });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 300 });
  el.scrollLeft = left;
  // Tiles 160px wide with a 10px gap: one step is the distance between two.
  const [a, b] = [...el.children] as HTMLElement[];
  Object.defineProperty(a, 'offsetLeft', { configurable: true, value: 0 });
  Object.defineProperty(b, 'offsetLeft', { configurable: true, value: 170 });
  const scrollBy = vi.fn();
  el.scrollBy = scrollBy as never;
  return scrollBy;
}

const wheel = (el: HTMLElement, deltaY: number, deltaX = 0) => {
  const e = new WheelEvent('wheel', { deltaY, deltaX, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

/**
 * A plain mouse wheel only scrolls vertically, so on a Mac a sideways strip
 * with its scrollbar hidden (the registered exams) left every tile past the
 * first few out of reach. A vertical notch over the strip now moves it one
 * tile; a trackpad's sideways swipe is left to the browser, and at either end
 * the wheel goes back to scrolling the page.
 */
describe('useWheelScrollsX', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('turns a vertical wheel notch into one tile sideways', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    const scrollBy = shape(el, 0);
    const e = wheel(el, 100);
    expect(e.defaultPrevented).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({ left: 160 + 10, behavior: 'smooth' });
  });

  it('moves one tile per notch, not one per event of a burst', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    const scrollBy = shape(el, 0);
    wheel(el, 30);
    wheel(el, 30);
    wheel(el, 30);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);
    wheel(el, 30);
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  it('goes back the other way', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    const scrollBy = shape(el, 300);
    wheel(el, -100);
    expect(scrollBy).toHaveBeenCalledWith({ left: -(160 + 10), behavior: 'smooth' });
  });

  it('leaves the page its scroll at either end of the strip', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    const atStart = shape(el, 0);
    expect(wheel(el, -100).defaultPrevented).toBe(false);
    expect(atStart).not.toHaveBeenCalled();
    const atEnd = shape(el, 600);
    expect(wheel(el, 100).defaultPrevented).toBe(false);
    expect(atEnd).not.toHaveBeenCalled();
  });

  it('leaves a sideways trackpad swipe, a pinch and a strip that fits to the browser', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    const scrollBy = shape(el, 0);
    expect(wheel(el, 5, 40).defaultPrevented).toBe(false);
    const pinch = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    // happy-dom drops ctrlKey from the init dict; a trackpad pinch carries it.
    Object.defineProperty(pinch, 'ctrlKey', { value: true });
    el.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(false);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 300 });
    expect(wheel(el, 100).defaultPrevented).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  // A strip that does not snap (the extension's exam timeline) follows the
  // wheel pixel for pixel instead.
  it('in pixel mode, scrolls by the wheel itself, every event', () => {
    render(<Strip mode="pixel" />);
    const el = screen.getByTestId('strip');
    const scrollBy = shape(el, 100);
    expect(wheel(el, 40).defaultPrevented).toBe(true);
    wheel(el, 40);
    expect(scrollBy).toHaveBeenNthCalledWith(1, { left: 40 });
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  // Some mice report lines (Firefox) or pages, not pixels: 3 lines is a notch,
  // and taken as 3px it barely moved the strip while the page stood still.
  it('in pixel mode, converts line and page wheel units to pixels', () => {
    render(<Strip mode="pixel" />);
    const el = screen.getByTestId('strip');
    const scrollBy = shape(el, 100);
    const lines = new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, cancelable: true });
    el.dispatchEvent(lines);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 48 });
    const page = new WheelEvent('wheel', { deltaY: 1, deltaMode: 2, cancelable: true });
    el.dispatchEvent(page);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 300 });
  });
});
