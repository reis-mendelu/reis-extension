import { describe, it, expect } from 'vitest';
import { canRouteFrom } from '../routableStart';

/** Real places, measured against the committed graph. */
const AT = {
  mainGate: [16.617241, 49.210133] as [number, number], // 96 m from centre
  frrms: [16.614118, 49.218161] as [number, number], // 849 m
  jakDorms: [16.630584, 49.216233] as [number, number], // 1223 m
  luzanky: [16.6085, 49.2065] as [number, number], // 715 m, no mapped path
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
    expect(canRouteFrom(AT.mainGate)).toBe(true);
    expect(canRouteFrom(AT.frrms)).toBe(true);
    expect(canRouteFrom(AT.jakDorms)).toBe(true);
  });

  it('says no across the city, where a press could only fail', () => {
    expect(canRouteFrom(AT.spilberk)).toBe(false);
    expect(canRouteFrom(AT.prague)).toBe(false);
  });

  it('says no in a park 715 m away, which a 1.5 km circle would have allowed', () => {
    expect(canRouteFrom(AT.luzanky)).toBe(false);
  });

  it('says yes when there is no fix, because not knowing is not a no', () => {
    // No fix means the permission was never granted and nothing was asked of
    // the student. Hiding the offer on a guess would take the feature away
    // from someone standing on the campus.
    expect(canRouteFrom(null)).toBe(true);
  });
});
