import { describe, it, expect } from 'vitest';
import { metres, nearestOnSegment } from '../geo';

const A: [number, number] = [16.6, 49.21];
const B: [number, number] = [16.6, 49.2101];

describe('metres', () => {
  it('measures 0.0001 degrees of latitude as about 11 m', () => {
    expect(metres(A, B)).toBeGreaterThan(10.5);
    expect(metres(A, B)).toBeLessThan(11.5);
  });

  it('agrees with the build pipeline, which uses the same flat-earth constants', () => {
    // 110540 m per degree of latitude — the value in scripts/lib/pathGeo.mjs.
    // If these two drift, a route's length stops matching the committed edge
    // lengths it was summed from.
    expect(metres([16.6, 49.0], [16.6, 50.0])).toBeCloseTo(110540, 0);
  });

  it('scales longitude by the cosine of the latitude', () => {
    // 111320 * cos(49.21 deg) is about 72 800 m per degree of longitude.
    expect(metres([16.6, 49.21], [17.6, 49.21])).toBeGreaterThan(72000);
    expect(metres([16.6, 49.21], [17.6, 49.21])).toBeLessThan(73000);
  });

  it('is zero for a point against itself', () => {
    expect(metres(A, A)).toBe(0);
  });
});

describe('nearestOnSegment', () => {
  it('finds the perpendicular foot when it falls inside the segment', () => {
    const r = nearestOnSegment([16.60005, 49.21005], A, B);
    expect(r.t).toBeGreaterThan(0.4);
    expect(r.t).toBeLessThan(0.6);
    expect(r.distanceM).toBeGreaterThan(0);
  });

  it('clamps to the near end when the foot falls before the segment', () => {
    const r = nearestOnSegment([16.6, 49.209], A, B);
    expect(r.t).toBe(0);
    expect(r.point).toEqual(A);
  });

  it('clamps to the far end when the foot falls past it', () => {
    const r = nearestOnSegment([16.6, 49.2105], A, B);
    expect(r.t).toBe(1);
    expect(r.point).toEqual(B);
  });

  it('projects in metres, not in raw degrees', () => {
    // A degree of longitude is 0.65 of a degree of latitude at this cosine.
    // Projecting in raw degrees puts the foot in the wrong place on any
    // segment that is not axis-aligned, which is most of them.
    const diagEnd: [number, number] = [16.6001, 49.2001];
    const r = nearestOnSegment([16.6001, 49.2], [16.6, 49.2], diagEnd);
    expect(r.t).toBeGreaterThan(0.2);
    expect(r.t).toBeLessThan(0.4);
  });

  it('handles a degenerate zero-length segment without dividing by zero', () => {
    const r = nearestOnSegment([16.6, 49.2105], A, A);
    expect(Number.isFinite(r.distanceM)).toBe(true);
    expect(r.t).toBe(0);
    expect(r.point).toEqual(A);
  });
});
