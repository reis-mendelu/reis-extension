import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useSwipeSteps } from '../useSwipeSteps';

/**
 * A caller may rule a gesture out where it STARTS: the subject sheet hands the
 * screen edges to the system back gesture and a scrolling table its own pan.
 * Optional, so the calendar's two callers behave exactly as before.
 */
describe('useSwipeSteps — ignoreStart', () => {
  function Host({ ignore }: { ignore?: () => boolean }) {
    const elementRef = useRef<HTMLDivElement>(null);
    const { handlers } = useSwipeSteps({
      elementRef,
      onMove: () => {},
      onEnd,
      onCancel: () => {},
      ignoreStart: ignore,
    });
    return (
      <div ref={elementRef} data-testid="surface" {...handlers}>
        <button type="button" onClick={onClick}>
          row
        </button>
      </div>
    );
  }
  const onEnd = vi.fn();
  const onClick = vi.fn();

  const swipe = (el: HTMLElement) => {
    fireEvent.pointerDown(el, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 220, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 140, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 140, clientY: 100, pointerId: 1 });
  };

  it('steps when nothing rules the start out', () => {
    onEnd.mockClear();
    render(<Host />);
    swipe(screen.getByTestId('surface'));
    expect(onEnd).toHaveBeenLastCalledWith(1);
  });

  it('does not step for a gesture that started off limits', () => {
    onEnd.mockClear();
    render(<Host ignore={() => true} />);
    swipe(screen.getByTestId('surface'));
    expect(onEnd).not.toHaveBeenCalledWith(1);
    expect(onEnd).not.toHaveBeenCalledWith(-1);
  });

  it('an ignored gesture does not eat the next tap', () => {
    // The click swallow is armed by a drag; a gesture the hook never took must
    // leave it disarmed, or the next row tapped would not open.
    onClick.mockClear();
    let ignore = false;
    render(<Host ignore={() => ignore} />);
    const surface = screen.getByTestId('surface');
    swipe(surface);
    ignore = true;
    swipe(surface);
    fireEvent.click(screen.getByText('row'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
