import { describe, expect, it } from 'vitest';
import { tileCorner, tileXY } from '../tileGround';

describe('tile maths', () => {
  it('round-trips a point through tile coordinates', () => {
    const [lng, lat] = [16.614247, 49.209591];
    const { x, y } = tileXY(lng, lat, 18);
    const [lng2, lat2] = tileCorner(x, y, 18);
    expect(lng2).toBeCloseTo(lng, 9);
    expect(lat2).toBeCloseTo(lat, 9);
  });

  it('puts building Q in the tile Leaflet requests for it at zoom 18', () => {
    const { x, y } = tileXY(16.614247, 49.209591, 18);
    expect([Math.floor(x), Math.floor(y)]).toEqual([143170, 89792]); // checked against the slippy-map formula in Python
  });
});
