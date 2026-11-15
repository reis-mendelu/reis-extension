import { describe, it, expect } from 'vitest';
import { spreadPins } from '../spreadPins';

type Pin = { key: string; x: number; y: number; spot: string };
const pin = (key: string, x: number, y: number, spot = key): Pin => ({ key, x, y, spot });
const sameSpot = (a: Pin, b: Pin) => a.spot === b.spot;
const at = (pins: Pin[], key: string) => {
  const p = pins.find((q) => q.key === key)!;
  return [p.x, p.y] as [number, number];
};
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('spreadPins', () => {
  it('leaves places at different spots exactly where they are, even overlapping', () => {
    // Two spots seen from far out: they touch on screen, and that is fine —
    // moving them would put a pin away from its court.
    const out = spreadPins([pin('a', 0, 0), pin('b', 5, 0), pin('c', 0, 100)], 34, sameSpot);
    expect(at(out, 'a')).toEqual([0, 0]);
    expect(at(out, 'b')).toEqual([5, 0]);
    expect(at(out, 'c')).toEqual([0, 100]);
  });

  it('leaves a pair at one spot alone once the map is close enough to show them apart', () => {
    // Zoomed in, the Píky court and the Bieblova gym are 300 px apart: pulling
    // them side by side moved each 130 px off its place.
    const out = spreadPins([pin('a', 0, 0, 's'), pin('b', 300, 0, 's')], 40, sameSpot);
    expect(at(out, 'a')).toEqual([0, 0]);
    expect(at(out, 'b')).toEqual([300, 0]);
  });

  it('pushes an overlapping pair apart along its own line, each by half the shortfall', () => {
    // The basketball court and the football pitch at Schreberovy zahrádky.
    const before: [number, number][] = [
      [100, 100],
      [106, 104],
    ];
    const out = spreadPins(
      [pin('bas', ...before[0]!, 'schreber'), pin('foo', ...before[1]!, 'schreber')],
      34,
      sameSpot
    );
    expect(dist(at(out, 'bas'), at(out, 'foo'))).toBeCloseTo(34);
    // Same midpoint, and nobody moved more than half the gap.
    expect((at(out, 'bas')[0] + at(out, 'foo')[0]) / 2).toBeCloseTo(103);
    expect((at(out, 'bas')[1] + at(out, 'foo')[1]) / 2).toBeCloseTo(102);
    expect(dist(at(out, 'bas'), before[0]!)).toBeLessThanOrEqual(17);
    expect(dist(at(out, 'foo'), before[1]!)).toBeLessThanOrEqual(17);
  });

  it('puts a pair on the very same point side by side, in a fixed order', () => {
    // No direction to push along: side by side, ordered by key so the two never
    // swap between renders.
    const out = spreadPins([pin('b', 50, 50, 's'), pin('a', 50, 50, 's')], 34, sameSpot);
    expect(at(out, 'a')).toEqual([33, 50]);
    expect(at(out, 'b')).toEqual([67, 50]);
  });

  it('carries every other field through untouched', () => {
    const out = spreadPins([pin('a', 0, 0)], 34, sameSpot);
    expect(out[0]).toEqual({ key: 'a', x: 0, y: 0, spot: 'a' });
  });
});
