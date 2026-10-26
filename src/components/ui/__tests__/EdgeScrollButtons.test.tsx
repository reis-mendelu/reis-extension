import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EdgeScrollButtons } from '../EdgeScrollButtons';
import { useAppStore } from '../../../store/useAppStore';

function Strip() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative">
      <div ref={ref} data-testid="strip">
        <span>tiles</span>
      </div>
      <EdgeScrollButtons scrollerRef={ref} />
    </div>
  );
}

/** Give the strip a shape and let the buttons re-measure, as a scroll does. */
function shape(el: HTMLElement, { width = 300, content = 900, left = 0 } = {}) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: content });
  el.scrollLeft = left;
  const scrollBy = vi.fn();
  el.scrollBy = scrollBy as never;
  act(() => {
    fireEvent.scroll(el);
  });
  return scrollBy;
}

const back = () => screen.queryByRole('button', { name: 'Posunout zpět' });
const forward = () => screen.queryByRole('button', { name: 'Posunout dál' });

/**
 * A sideways strip's way across for a mouse. A plain wheel scrolls only
 * vertically, and in the iPad app on a Mac the scrollbar is an overlay a
 * pointer cannot grab, so a strip that overflows offers two buttons. They are
 * buttons rather than a re-mapped wheel: a MacBook's trackpad sends the same
 * pixel wheel events as a mouse, and stealing its vertical scroll over a strip
 * stopped the page under the pointer.
 */
describe('EdgeScrollButtons', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', isTouch: false } as never));

  it('offers only the way that is open: forward at the start, back at the end', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    shape(el, { left: 0 });
    expect(back()).toBeNull();
    expect(forward()).not.toBeNull();
    shape(el, { left: 600 });
    expect(back()).not.toBeNull();
    expect(forward()).toBeNull();
  });

  it('moves most of a strip-width per press, smoothly', () => {
    render(<Strip />);
    const scrollBy = shape(screen.getByTestId('strip'), { left: 300 });
    fireEvent.click(forward()!);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' });
    fireEvent.click(back()!);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -240, behavior: 'smooth' });
  });

  it('shows nothing when the strip fits', () => {
    render(<Strip />);
    shape(screen.getByTestId('strip'), { content: 300 });
    expect(back()).toBeNull();
    expect(forward()).toBeNull();
  });

  it('shows nothing on a touch screen, where the strip is swiped', () => {
    useAppStore.setState({ isTouch: true } as never);
    render(<Strip />);
    shape(screen.getByTestId('strip'), { left: 300 });
    expect(back()).toBeNull();
    expect(forward()).toBeNull();
  });

  it('leaves the wheel alone: a trackpad scrolling the page over the strip is not stopped', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    shape(el, { left: 300 });
    // A two-finger vertical trackpad scroll: pixel deltas with momentum.
    for (const deltaY of [2.5, 7.25, 14, 9.5, 4.75, 1.25]) {
      const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
  });
});
