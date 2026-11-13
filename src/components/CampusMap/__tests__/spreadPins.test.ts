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

  it('moves a spread pair together, so it stays a pair', () => {
    // The pair lands at (86,102) and (120,102); S-klub's label sits above the
    // left one. Both step down the 18 px the left one needs.
    const out = spreadPins([pin('a', 100, 100), pin('b', 106, 104)], 34, [{ x: 86, y: 80, r: 40 }]);
    expect(at(out, 'a')).toEqual([86, 120]);
    expect(at(out, 'b')).toEqual([120, 120]);
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
