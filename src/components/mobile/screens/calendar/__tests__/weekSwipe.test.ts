import { describe, it, expect } from 'vitest';
import {
  weekSwipeSteps,
  isHorizontal,
  WEEK_SWIPE_DISTANCE_PX,
  HORIZONTAL_BIAS,
} from '../weekSwipe';

/**
 * `velocity` is the RELEASE velocity in px/ms, positive rightward — the same
 * measure `releaseVelocity` produces for the sheets, and the same reversal
 * guard applies. Its windowing has its own tests in
 * primitives/__tests__/sheetDragVelocity.test.ts; these are the rules built on
 * top of it.
 */
describe('weekSwipeSteps', () => {
  it('pulls next week in on a leftward drag, the way a carousel does', () => {
    expect(weekSwipeSteps(-WEEK_SWIPE_DISTANCE_PX, -0.02)).toBe(1);
  });

  it('brings last week back on a rightward drag', () => {
    expect(weekSwipeSteps(WEEK_SWIPE_DISTANCE_PX, 0.02)).toBe(-1);
  });

  it('takes a short fast flick, where the distance alone would not', () => {
    expect(weekSwipeSteps(-30, -0.8)).toBe(1);
    expect(weekSwipeSteps(30, 0.8)).toBe(-1);
  });

  it('stays put on a short slow drag', () => {
    expect(weekSwipeSteps(-30, -0.02)).toBe(0);
    expect(weekSwipeSteps(30, 0.02)).toBe(0);
  });

  /**
   * The guard the sheets needed too. Dragging a long way and then pushing back
   * before letting go has to leave the week alone — the finger's last direction
   * is the decision, not the distance it covered getting there.
   */
  it('stays put when the finger is heading back at release', () => {
    expect(weekSwipeSteps(-120, 0.4)).toBe(0);
    expect(weekSwipeSteps(120, -0.4)).toBe(0);
  });

  it('moves one week however far the drag went', () => {
    // Aimability over speed: a strip that jumped four weeks on one long drag
    // could not be landed on a chosen week.
    expect(weekSwipeSteps(-900, -3)).toBe(1);
    expect(weekSwipeSteps(900, 3)).toBe(-1);
  });

  it('does nothing without travel', () => {
    expect(weekSwipeSteps(0, 5)).toBe(0);
    expect(weekSwipeSteps(0, 0)).toBe(0);
  });
});

/**
 * The strip sits directly above the scrolling agenda, so telling "change week"
 * apart from "scroll the day's lessons" is the difference between a gesture and
 * an accident.
 */
describe('isHorizontal', () => {
  it('claims a clearly sideways swipe', () => {
    expect(isHorizontal(80, 5)).toBe(true);
  });

  it('leaves a vertical scroll to the page', () => {
    expect(isHorizontal(5, 80)).toBe(false);
  });

  it('leaves a lazy diagonal to the page rather than jumping a week past it', () => {
    // 60 across, 50 down: sideways, but not by the required margin.
    expect(isHorizontal(60, 50)).toBe(false);
    expect(60 / 50).toBeLessThan(HORIZONTAL_BIAS);
  });

  it('claims a diagonal that leads sideways by the margin', () => {
    expect(isHorizontal(80, 50)).toBe(true);
  });

  it('claims nothing at rest, so a tap is never a swipe', () => {
    expect(isHorizontal(0, 0)).toBe(false);
  });

  it('is symmetric in both directions', () => {
    expect(isHorizontal(-80, 5)).toBe(true);
    expect(isHorizontal(-80, -5)).toBe(true);
  });
});
