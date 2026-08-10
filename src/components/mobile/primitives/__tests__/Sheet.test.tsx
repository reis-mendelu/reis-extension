import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  it('renders its children', () => {
    render(
      <Sheet size="content" onClose={() => {}}>
        hello
      </Sheet>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="content" onClose={onClose}>
        body
      </Sheet>
    );
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the panel itself is clicked', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="content" onClose={onClose}>
        body
      </Sheet>
    );
    fireEvent.click(screen.getByTestId('sheet-panel'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('full size pins the panel below the status area; content size hugs the bottom', () => {
    const { rerender } = render(
      <Sheet size="full" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.getByTestId('sheet-panel').className).toContain('top-[70px]');
    rerender(
      <Sheet size="content" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.getByTestId('sheet-panel').className).not.toContain('top-[70px]');
  });

  /**
   * Drag-to-dismiss, driven through the panel's pointer handlers. jsdom has no
   * gesture model, so this asserts the decision rather than the animation: a
   * long downward drag must call onClose.
   */
  it('closes on a long downward drag', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="full" onClose={onClose}>
        x
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    fireEvent.pointerDown(panel, { clientY: 100, timeStamp: 0 });
    fireEvent.pointerMove(panel, { clientY: 300, timeStamp: 200 });
    fireEvent.pointerUp(panel, { clientY: 300, timeStamp: 200 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The distance-vs-velocity rules live in sheetDrag.test.ts, not here: jsdom
  // stamps its own event timeStamps and ignores the ones fireEvent is given, so
  // every drag reads as an instant flick and a "slow drag" cannot be expressed.

  /**
   * A cancelled gesture is not a completed one. The browser fires pointercancel
   * when it takes the gesture over (a pan, a system edge swipe), and the student
   * never lifted a finger to say "close" — reusing the pointerup handler there
   * would dismiss the sheet out from under them mid-drag.
   */
  it('does not close when the browser cancels the drag', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="full" onClose={onClose}>
        x
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    fireEvent.pointerDown(panel, { clientY: 100, timeStamp: 0 });
    fireEvent.pointerMove(panel, { clientY: 300, timeStamp: 200 });
    fireEvent.pointerCancel(panel, { clientY: 300, timeStamp: 200 });
    expect(onClose).not.toHaveBeenCalled();
  });

  /** And the panel must settle back, not stay parked where the finger left it. */
  it('resets the drag offset after a cancelled gesture', () => {
    render(
      <Sheet size="full" onClose={() => {}}>
        x
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    fireEvent.pointerDown(panel, { clientY: 100, timeStamp: 0 });
    fireEvent.pointerMove(panel, { clientY: 300, timeStamp: 200 });
    expect(panel.style.transform).toBe('translateY(200px)');
    fireEvent.pointerCancel(panel, { clientY: 300, timeStamp: 200 });
    expect(panel.style.transform).toBe('');
  });

  /**
   * An upward drag on a bottom-anchored sheet has nowhere to travel, and must
   * never be mistaken for a dismissal.
   */
  it('ignores an upward drag', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="full" onClose={onClose}>
        x
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    fireEvent.pointerDown(panel, { clientY: 400, timeStamp: 0 });
    fireEvent.pointerMove(panel, { clientY: 100, timeStamp: 200 });
    fireEvent.pointerUp(panel, { clientY: 100, timeStamp: 200 });
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * The subject drawer is a whole screen, not a sheet: it already filled all but
 * 70px, so the strip of dimmed screen above it and the slide-up-from-the-bottom
 * entrance were suggesting a temporary overlay over something you could get
 * back to by looking past it. It stays in the same sheet STACK — back still
 * pops it — but presents as a pushed screen.
 */
describe('Sheet variant="screen"', () => {
  it('covers the whole viewport instead of stopping below the status area', () => {
    render(
      <Sheet size="full" variant="screen" onClose={() => {}}>
        x
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    expect(panel.className).toContain('inset-0');
    expect(panel.className).not.toContain('top-[70px]');
  });

  it('insets its content below the status bar', () => {
    render(
      <Sheet size="full" variant="screen" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.getByTestId('sheet-panel').className).toContain('var(--safe-top');
  });

  // No dimmed layer: there is nothing behind a screen to see through to.
  it('renders no backdrop', () => {
    render(
      <Sheet size="full" variant="screen" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument();
  });

  /**
   * A screen is left via back, not by being thrown downward — and with no
   * backdrop there is nothing to tap outside of either, so an accidental
   * dismissal would have no undo.
   */
  it('does not dismiss on a downward drag', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="full" variant="screen" onClose={onClose}>
        x
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    fireEvent.pointerDown(panel, { clientY: 100 });
    fireEvent.pointerMove(panel, { clientY: 500 });
    fireEvent.pointerUp(panel, { clientY: 500 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still defaults to sheet presentation for every other caller', () => {
    render(
      <Sheet size="full" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.getByTestId('sheet-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-panel').className).toContain('top-[70px]');
  });
});
