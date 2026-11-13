import { describe, it, expect } from 'vitest';
import { spreadPins } from '../spreadPins';

const pin = (key: string, x: number, y: number) => ({ key, x, y });
const at = (pins: { key: string; x: number; y: number }[], key: string) => {
  const p = pins.find((q) => q.key === key)!;
  return [p.x, p.y];
};

describe('spreadPins', () => {
  it('leaves pins that are far enough apart where they are', () => {
    const out = spreadPins([pin('a', 0, 0), pin('b', 100, 0), pin('c', 0, 100)], 34);
    expect(at(out, 'a')).toEqual([0, 0]);
    expect(at(out, 'b')).toEqual([100, 0]);
    expect(at(out, 'c')).toEqual([0, 100]);
  });

  it('sets two overlapping pins side by side, one gap apart, around their midpoint', () => {
    // The basketball court and the football pitch at Schreberovy zahrádky are
    // ~6 m apart: on screen, the same spot.
    const out = spreadPins([pin('bas', 100, 100), pin('foo', 106, 104)], 34);
    expect(at(out, 'bas')).toEqual([86, 102]);
    expect(at(out, 'foo')).toEqual([120, 102]);
  });

  it('keeps the western place on the left', () => {
    const out = spreadPins([pin('east', 110, 50), pin('west', 100, 50)], 34);
    expect(at(out, 'west')[0]).toBeLessThan(at(out, 'east')[0]!);
  });

  it('spreads a cluster of three evenly', () => {
    const out = spreadPins([pin('a', 0, 0), pin('b', 10, 0), pin('c', 20, 0)], 30);
    expect(at(out, 'a')).toEqual([-20, 0]);
    expect(at(out, 'b')).toEqual([10, 0]);
    expect(at(out, 'c')).toEqual([40, 0]);
  });

  it('steps a pin straight away from another map pin it would cover', () => {
    // 50 px from the obstacle, which needs 100: pushed out along the same line.
    const out = spreadPins([pin('a', 30, 40)], 34, [{ x: 0, y: 0, r: 100 }]);
    expect(at(out, 'a')).toEqual([60, 80]);
  });

  it('moves a spread pair together, so it stays a pair, until both are clear', () => {
    // The pair lands at (86,102) and (120,102); S-klub's label sits above the
    // left one.
    const obstacle = { x: 86, y: 80, r: 40 };
    const out = spreadPins([pin('a', 100, 100), pin('b', 106, 104)], 34, [obstacle]);
    const [ax, ay] = at(out, 'a') as [number, number];
    const [bx, by] = at(out, 'b') as [number, number];
    expect([bx - ax, by - ay]).toEqual([34, 0]);
    for (const [x, y] of [
      [ax, ay],
      [bx, by],
    ] as const) {
      expect(Math.hypot(x - obstacle.x, y - obstacle.y)).toBeGreaterThanOrEqual(40);
    }
  });

  it('clears every member, not just the deepest one', () => {
    // Pushed sideways by the left pin's need, the right pin stayed inside
    // (CodeRabbit, PR 679): the whole pair has to end up outside.
    const obstacle = { x: 0, y: 0, r: 40 };
    const out = spreadPins([pin('a', -1, 0), pin('b', 1, 0)], 34, [obstacle]);
    for (const p of out) {
      expect(Math.hypot(p.x - obstacle.x, p.y - obstacle.y)).toBeGreaterThanOrEqual(40);
    }
    expect(at(out, 'b')[0]! - at(out, 'a')[0]!).toBe(34);
  });

  it('clears a cluster squeezed between two obstacles', () => {
    const obstacles = [
      { x: 0, y: 0, r: 30 },
      { x: 0, y: 50, r: 30 },
    ];
    const out = spreadPins([pin('a', 0, 25)], 34, obstacles);
    for (const o of obstacles) {
      expect(Math.hypot(out[0]!.x - o.x, out[0]!.y - o.y)).toBeGreaterThanOrEqual(30);
    }
  });

  it('keeps a spread cluster off the pins next to it', () => {
    // (0,0) and (0,20) spread to (-16,10) and (16,10), 24 px from the pin at
    // (40,10) (CodeRabbit, PR 679). All three then need a gap of their own.
    const out = spreadPins([pin('a', 0, 0), pin('b', 0, 20), pin('c', 40, 10)], 32);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const d = Math.hypot(out[i]!.x - out[j]!.x, out[i]!.y - out[j]!.y);
        expect(d).toBeGreaterThanOrEqual(31.99);
      }
    }
  });

  it('leaves pins that are already clear of every obstacle alone', () => {
    const out = spreadPins([pin('a', 200, 200)], 34, [{ x: 0, y: 0, r: 60 }]);
    expect(at(out, 'a')).toEqual([200, 200]);
  });

  it('carries every other field through untouched', () => {
    const out = spreadPins([{ key: 'a', x: 0, y: 0, place: 'kept' }], 34);
    expect(out[0]).toEqual({ key: 'a', x: 0, y: 0, place: 'kept' });
  });
});
