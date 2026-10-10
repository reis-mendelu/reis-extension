import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { canRouteFrom, hasWalksTo } from '../routableStart';

// The answer reads the garden's hours, so the clock is pinned to a weekday
// morning (garden open) unless a test says otherwise.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T10:00:00'));
});
afterEach(() => vi.useRealTimers());

/** Real places, measured against the committed graph. */
const AT = {
  mainGate: [16.617241, 49.210133] as [number, number], // 96 m from centre
  frrms: [16.614118, 49.218161] as [number, number], // 849 m
  jakDorms: [16.630584, 49.216233] as [number, number], // 1223 m
  luzanky: [16.6085, 49.2065] as [number, number], // 715 m, no mapped path
  erbenova: [16.6142, 49.2088] as [number, number], // snaps 9 m, reaches nothing
  spilberk: [16.5993, 49.1949] as [number, number], // 2122 m
  prague: [14.42, 50.08] as [number, number],
};

/**
 * Whether the offer is worth making at all.
 *
 * Asked for as "within 1.5 km of campus". This is that question answered by
 * the router rather than by a circle, because the two disagree in the one
 * place that matters: Lužánky park is 715 m from campus — inside any 1.5 km
 * circle — and has no mapped path within the snap tolerance, so a walk cannot
 * be built from it. A circle would offer the pill there and the press would do
 * nothing, which is the failure this rule exists to prevent.
 */
describe('canRouteFrom', () => {
  it('says yes where the router can actually start', () => {
    // The campus itself and both off-campus corridors the graph joins at
    // declared anchors — the two starts the committed journeys walk from.
    expect(canRouteFrom(AT.mainGate, 'Q')).toBe(true);
    expect(canRouteFrom(AT.frrms, 'Q')).toBe(true);
    expect(canRouteFrom(AT.jakDorms, 'Q')).toBe(true);
  });

  /**
   * The same gate hours the press uses. FRRMS reaches campus only through the
   * garden, and the router will not take a shut gate — so at night an offer
   * here would be pressed and draw nothing, the dead press this whole rule
   * exists to prevent.
   */
  it('says no at FRRMS once the garden is shut, because the press would draw nothing', () => {
    vi.setSystemTime(new Date('2026-09-27T23:14:00')); // Sunday night
    expect(canRouteFrom(AT.frrms, 'Q')).toBe(false);
    // Campus itself does not depend on the garden.
    expect(canRouteFrom(AT.mainGate, 'Q')).toBe(true);
  });

  it('says no across the city, where a press could only fail', () => {
    expect(canRouteFrom(AT.spilberk, 'Q')).toBe(false);
    expect(canRouteFrom(AT.prague, 'Q')).toBe(false);
  });

  it('says no in a park 715 m away, which a 1.5 km circle would have allowed', () => {
    expect(canRouteFrom(AT.luzanky, 'Q')).toBe(false);
  });

  it('says no where the fix SNAPS but the path reaches nothing', () => {
    // Erbenova, on the west side. It lands 9 m from a mapped stretch, so a
    // snap-only gate said yes — and then no walk to any building existed from
    // it, in any direction. Driven from thirteen places, this was the one that
    // offered the pill and drew nothing when pressed: the exact dead press the
    // gate exists to prevent. Snapping is not reachability.
    expect(canRouteFrom(AT.erbenova, 'Q')).toBe(false);
  });

  it('answers for the building the lesson is in, not for the campus at large', () => {
    // Budova Z has no nodes, so nowhere can route to it. Asking about the
    // student's own lecture keeps the offer honest per lesson rather than per
    // position.
    expect(canRouteFrom(AT.mainGate, 'Z')).toBe(false);
  });

  it('says yes when there is no fix, because not knowing is not a no', () => {
    // No fix means the permission was never granted and nothing was asked of
    // the student. Hiding the offer on a guess would take the feature away
    // from someone standing on the campus.
    expect(canRouteFrom(null, 'Q')).toBe(true);
  });
});

describe('canRouteFrom, for a building with no graph nodes', () => {
  it('offers no walk to budova Z, even with no position fix — Z has no graph nodes in v1', () => {
    expect(canRouteFrom(null, 'Z')).toBe(false);
  });

  it('still offers a walk to a graph building when the position is unknown', () => {
    expect(canRouteFrom(null, 'Q')).toBe(true);
  });
});

describe('hasWalksTo', () => {
  it('is false for budova Z, which has a floor plan but no graph nodes (v1)', () => {
    expect(hasWalksTo('Z')).toBe(false);
  });

  it('is true for a surveyed building', () => {
    expect(hasWalksTo('Q')).toBe(true);
  });
});
