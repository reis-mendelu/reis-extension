import { describe, it, expect } from 'vitest';
import { chipOffset } from '../chipPlacement';

const W = 120;
const H = 44;

describe('chipOffset', () => {
  it('sits on its coordinate when nothing is near', () => {
    expect(chipOffset({ x: 100, y: 100 }, [{ x: 400, y: 400 }], W, H)).toEqual({ x: 0, y: 0 });
  });

  it('steps left of a pin just east of it (Vazbič on building A)', () => {
    const o = chipOffset({ x: 200, y: 200 }, [{ x: 237, y: 196 }], W, H);
    expect(o.x).toBeLessThan(0);
    expect(o.y).toBe(0);
    // Whole hit box clear of the other pin's 44 px square.
    expect(200 + o.x + W / 2).toBeLessThanOrEqual(237 - 22);
  });

  it('goes above when both sides are taken', () => {
    const o = chipOffset(
      { x: 200, y: 200 },
      [
        { x: 130, y: 200 },
        { x: 270, y: 200 },
      ],
      W,
      H
    );
    expect(o).toEqual({ x: 0, y: -(H + 4) });
  });
});
