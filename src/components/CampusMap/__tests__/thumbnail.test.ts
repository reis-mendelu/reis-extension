import { describe, it, expect } from 'vitest';
import { projectRing } from '../thumbnail';

describe('projectRing', () => {
  it('maps a lat/lng ring into the SVG box, flipping Y', () => {
    const ring: [number, number][] = [[49.20, 16.60], [49.20, 16.62], [49.22, 16.62], [49.22, 16.60]];
    const pts = projectRing(ring, { w: 100, h: 100, pad: 0 },
      { minLat: 49.20, maxLat: 49.22, minLng: 16.60, maxLng: 16.62 });
    // first vertex is bottom-left -> x=0, y=h (Y flipped)
    expect(pts.split(' ')[0]).toBe('0,100');
    // a top-right vertex -> x=100, y=0
    expect(pts).toContain('100,0');
  });
});
