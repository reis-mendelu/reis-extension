import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useWeekSwipe } from '../useWeekSwipe';
import * as rules from '../weekSwipe';

/**
 * The release velocity has to survive the release.
 *
 * `onPointerUp` cleared the gesture state before it measured it — `reset()`
 * emptied the sample buffer, and the `releaseVelocity` call two lines later saw
 * a single point and returned 0. Every swipe was then decided by distance
 * alone: the reversal guard was dead, so dragging the strip well past the
 * threshold, thinking better of it and pushing back before letting go still
 * changed the week.
 *
 * Found by driving the real strip in the browser, not by a test: the pure rules
 * are tested directly and were right, and the DOM tests only ask whether a long
 * swipe changes the week — which it did, through the clause that still worked.
 *
 * Asserted through the rule function's ARGUMENTS rather than through an
 * outcome, because happy-dom stamps its own `timeStamp` on synthesised events
 * and ignores the one `fireEvent` is given: no DOM test here can dictate a
 * gesture's speed, so no DOM test can produce a reversal. What it can prove is
 * that a real measurement reaches the rule at all.
 */
describe('useWeekSwipe — the release velocity reaches the rule', () => {
  function Host() {
    const stripRef = useRef<HTMLDivElement>(null);
    const { handlers } = useWeekSwipe({
      stripRef,
      onMove: () => {},
      onEnd: () => {},
      onCancel: () => {},
    });
    return <div ref={stripRef} data-testid="strip" {...handlers} />;
  }

  beforeEach(() => vi.restoreAllMocks());

  const swipe = (strip: HTMLElement, xs: number[]) => {
    fireEvent.pointerDown(strip, { clientX: 300, clientY: 100, pointerId: 1 });
    for (const x of xs) fireEvent.pointerMove(strip, { clientX: x, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(strip, { clientX: xs[xs.length - 1], clientY: 100, pointerId: 1 });
  };

  it('hands the rule a measured velocity, not a zero from an emptied buffer', () => {
    const spy = vi.spyOn(rules, 'weekSwipeSteps');
    render(<Host />);
    swipe(screen.getByTestId('strip'), [260, 220, 180, 140]);

    expect(spy).toHaveBeenCalledOnce();
    const [dx, velocity] = spy.mock.calls[0] as [number, number];
    expect(dx).toBe(-160);
    // A leftward gesture is a negative velocity. Zero is the bug: it is what a
    // single-sample buffer produces, and it lets the distance clause decide
    // every swipe on its own.
    expect(velocity).not.toBe(0);
    expect(velocity).toBeLessThan(0);
  });

  it('measures a rightward gesture with the opposite sign', () => {
    const spy = vi.spyOn(rules, 'weekSwipeSteps');
    render(<Host />);
    swipe(screen.getByTestId('strip'), [340, 380, 420, 460]);

    const [dx, velocity] = spy.mock.calls[0] as [number, number];
    expect(dx).toBe(160);
    expect(velocity).toBeGreaterThan(0);
  });

  it('does not consult the rule for a gesture it never owned', () => {
    // A vertical drag belongs to the agenda; asking the rule about it would
    // mean the arbitration had already failed.
    const spy = vi.spyOn(rules, 'weekSwipeSteps');
    render(<Host />);
    const strip = screen.getByTestId('strip');
    fireEvent.pointerDown(strip, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 302, clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(strip, { clientX: 302, clientY: 260, pointerId: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('starts each gesture from a clean buffer', () => {
    // The buffer must be emptied SOMEWHERE, or a second swipe measures across
    // the gap since the first — the reason the clear was where the bug was.
    const spy = vi.spyOn(rules, 'weekSwipeSteps');
    render(<Host />);
    const strip = screen.getByTestId('strip');
    swipe(strip, [260, 220, 180, 140]);
    swipe(strip, [260, 220, 180, 140]);
    expect(spy).toHaveBeenCalledTimes(2);
    const [, first] = spy.mock.calls[0] as [number, number];
    const [, second] = spy.mock.calls[1] as [number, number];
    // Both are real measurements of the same shape of gesture; a buffer carried
    // over from the first would make the second's dt span both and collapse it
    // towards nothing.
    expect(second).toBeLessThan(0);
    expect(Math.sign(second)).toBe(Math.sign(first));
  });
});
