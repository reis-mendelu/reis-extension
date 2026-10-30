import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useSwipeSteps } from '../useSwipeSteps';

/**
 * Two fingers are a pinch, never a swipe (spec 2026-10-30): the calendar
 * zooms between Den and Týden with a pinch, and the first finger of a pinch
 * drifting sideways must not also step a day or a week.
 */
describe('useSwipeSteps — a second finger', () => {
  const onEnd = vi.fn();
  const onCancel = vi.fn();
  const onMove = vi.fn();
  function Host() {
    const elementRef = useRef<HTMLDivElement>(null);
    const { handlers } = useSwipeSteps({ elementRef, onMove, onEnd, onCancel });
    return <div ref={elementRef} data-testid="surface" {...handlers} />;
  }

  it('cancels the swipe the first finger started', () => {
    onEnd.mockClear();
    onCancel.mockClear();
    onMove.mockClear();
    render(<Host />);
    const el = screen.getByTestId('surface');
    fireEvent.pointerDown(el, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 260, clientY: 100, pointerId: 1 });
    fireEvent.pointerDown(el, { clientX: 100, clientY: 300, pointerId: 2 });
    const movesBefore = onMove.mock.calls.length;
    fireEvent.pointerMove(el, { clientX: 140, clientY: 100, pointerId: 1 });
    // No live movement once the second finger is down (PR #618 review).
    expect(onMove.mock.calls.length).toBe(movesBefore);
    fireEvent.pointerUp(el, { clientX: 140, clientY: 100, pointerId: 1 });
    expect(onCancel).toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalledWith(1);
    expect(onEnd).not.toHaveBeenCalledWith(-1);
  });

  // PR #618 review: the pinch covers the whole calendar, so a second finger
  // landing on ANOTHER surface (the day strip, the Teď card) must call the
  // swipe off too, not only one on this surface.
  it('cancels when the second finger lands anywhere else on the page', () => {
    onEnd.mockClear();
    onCancel.mockClear();
    onMove.mockClear();
    render(
      <>
        <Host />
        <div data-testid="elsewhere" />
      </>
    );
    const el = screen.getByTestId('surface');
    fireEvent.pointerDown(el, {
      clientX: 300,
      clientY: 100,
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
    });
    fireEvent.pointerMove(el, { clientX: 260, clientY: 100, pointerId: 1 });
    fireEvent.pointerDown(screen.getByTestId('elsewhere'), {
      clientX: 50,
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: false,
    });
    const movesBefore = onMove.mock.calls.length;
    fireEvent.pointerMove(el, { clientX: 140, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 140, clientY: 100, pointerId: 1 });
    expect(onCancel).toHaveBeenCalled();
    expect(onMove.mock.calls.length).toBe(movesBefore);
    expect(onEnd).not.toHaveBeenCalledWith(1);
  });
});
