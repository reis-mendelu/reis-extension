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
