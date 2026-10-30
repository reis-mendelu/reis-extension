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

  // Tiles arrive with a sync after the strip has mounted; its own size never
  // changes, so only watching the content catches the new overflow.
  it('shows the forward button when content arrives after mount', async () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    shape(el, { content: 300 });
    expect(forward()).toBeNull();
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 900 });
    await act(async () => {
      // Text edited in place (a name resolving): a characterData change only.
      (el.firstElementChild!.firstChild as Text).data = 'many more tiles';
    });
    expect(forward()).not.toBeNull();
  });

  it('re-measures when the strip or its content resizes', () => {
    const callbacks: (() => void)[] = [];
    const observed: Element[] = [];
    const RO = vi.fn(function (this: unknown, cb: () => void) {
      callbacks.push(cb);
      return { observe: (t: Element) => observed.push(t), disconnect: vi.fn(), unobserve: vi.fn() };
    });
    vi.stubGlobal('ResizeObserver', RO);
    render(<Strip />);
    const el = screen.getByTestId('strip');
    shape(el, { content: 300 });
    expect(observed).toContain(el);
    expect(observed).toContain(el.firstElementChild);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 900 });
    act(() => callbacks.forEach((cb) => cb()));
    expect(forward()).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('lets go of the strip on unmount', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function () {
        return { observe: vi.fn(), disconnect, unobserve: vi.fn() };
      })
    );
    const { unmount } = render(<Strip />);
    const el = screen.getByTestId('strip');
    const remove = vi.spyOn(el, 'removeEventListener');
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    vi.unstubAllGlobals();
  });

  // Release review (cubic): pressing forward until the end unmounts the
  // focused button, and focus fell to <body>. It moves to the other one.
  it('hands focus to the remaining button when the focused one disappears', () => {
    render(<Strip />);
    const el = screen.getByTestId('strip');
    shape(el, { left: 300 });
    forward()!.focus();
    expect(document.activeElement).toBe(forward());
    shape(el, { left: 600 });
    expect(forward()).toBeNull();
    expect(document.activeElement).toBe(back());
  });
});
