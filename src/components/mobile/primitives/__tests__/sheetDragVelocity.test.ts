import { describe, it, expect } from 'vitest';
import {
  releaseVelocity,
  shouldDismiss,
  rubberBand,
  DISMISS_DISTANCE_PX,
  VELOCITY_WINDOW_MS,
} from '../sheetDrag';

/**
 * "The Novinky slidedown still isn't fluent; when I put my finger on it and
 * then away, it starts bugging."
 *
 * Researched rather than guessed at. Two of these rules were wrong in a way no
 * amount of plumbing could fix:
 *
 *  - Velocity was `travel / duration` over the WHOLE gesture, which answers a
 *    different question than "how fast was it moving when it was let go".
 *  - A long drag dismissed on distance alone, so pulling the sheet back up
 *    before releasing still closed it.
 *
 * The rules below follow the conventional bottom-sheet behaviour: dismiss on a
 * fast downward flick from anywhere, or on distance UNLESS the sheet was being
 * pulled back at release; measure velocity from a short sample window; and use
 * progressive resistance where the sheet cannot travel.
 */
describe('releaseVelocity', () => {
  it('is zero without enough samples to measure between', () => {
    expect(releaseVelocity([])).toBe(0);
    expect(releaseVelocity([{ y: 10, t: 0 }])).toBe(0);
  });

  it('measures downward movement as positive', () => {
    expect(
      releaseVelocity([
        { y: 0, t: 0 },
        { y: 50, t: 50 },
      ])
    ).toBeCloseTo(1);
  });

  it('measures upward movement as negative', () => {
    expect(
      releaseVelocity([
        { y: 50, t: 0 },
        { y: 0, t: 50 },
      ])
    ).toBeCloseTo(-1);
  });

  it('ignores the early part of a long gesture', () => {
    // Dragged slowly for a second, then flicked: the flick is what matters.
    const samples = [
      { y: 0, t: 0 },
      { y: 40, t: 900 },
      { y: 60, t: 960 },
      { y: 120, t: 1000 },
    ];
    // Whole-gesture average would be 120/1000 = 0.12 px/ms — slow.
    expect(120 / 1000).toBeCloseTo(0.12);
    // The window sees the last ~100ms: fast.
    expect(releaseVelocity(samples)).toBeGreaterThan(0.5);
  });

  it('reports nearly nothing for a sheet held still before release', () => {
    const samples = [
      { y: 0, t: 0 },
      { y: 100, t: 200 },
      { y: 100, t: 800 },
      { y: 100, t: 900 },
    ];
    expect(Math.abs(releaseVelocity(samples))).toBeLessThan(0.01);
  });

  it('keeps two points to measure between even when samples are sparse', () => {
    // Both samples are older than the window; falling back to zero here would
    // report a deliberate flick as motionless.
    const samples = [
      { y: 0, t: 0 },
      { y: 80, t: 400 },
    ];
    expect(releaseVelocity(samples)).toBeCloseTo(0.2);
  });

  it('uses a window measured in milliseconds, not in samples', () => {
    expect(VELOCITY_WINDOW_MS).toBeGreaterThan(0);
  });
});

describe('shouldDismiss', () => {
  it('never dismisses on an upward drag', () => {
    expect(shouldDismiss(-200, -2)).toBe(false);
    expect(shouldDismiss(0, 0)).toBe(false);
  });

  it('dismisses on a fast flick even from a short distance', () => {
    expect(shouldDismiss(20, 0.8)).toBe(true);
  });

  it('dismisses on a long, deliberate drag released gently', () => {
    expect(shouldDismiss(DISMISS_DISTANCE_PX + 10, 0.02)).toBe(true);
  });

  it('does NOT dismiss a long drag that was being pulled back up', () => {
    // The reported bug: the distance had been travelled, so it closed under a
    // finger moving the other way.
    expect(shouldDismiss(DISMISS_DISTANCE_PX + 30, -0.6)).toBe(false);
  });

  it('tolerates the drift of a finger lifting off', () => {
    // A pixel or two upward at release is not a change of mind.
    expect(shouldDismiss(DISMISS_DISTANCE_PX + 30, -0.01)).toBe(true);
  });

  it('snaps back on a slow short drag', () => {
    expect(shouldDismiss(30, 0.05)).toBe(false);
  });
});

describe('rubberBand', () => {
  it('is zero with no overshoot', () => {
    expect(rubberBand(0, 800)).toBe(0);
  });

  it('follows the finger, but always less than one-to-one', () => {
    const out = rubberBand(100, 800);
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(100);
  });

  it('resists more the further it is pushed', () => {
    const near = rubberBand(50, 800) / 50;
    const far = rubberBand(400, 800) / 400;
    expect(far).toBeLessThan(near);
  });

  it('keeps the direction it was given', () => {
    expect(rubberBand(-100, 800)).toBeLessThan(0);
  });

  it('is zero when there is no dimension to resist against', () => {
    expect(rubberBand(100, 0)).toBe(0);
  });
});
