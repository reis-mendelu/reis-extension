import { describe, expect, it } from 'vitest';
import { spotlight, SPOT_FAR, SPOT_NEAR } from '../tiltLook';

describe('spotlight', () => {
  it('draws the lit room’s neighbours fully and fades the rest of the floor out', () => {
    expect(spotlight(0)).toBe(1);
    expect(spotlight(SPOT_NEAR)).toBe(1);
    expect(spotlight((SPOT_NEAR + SPOT_FAR) / 2)).toBeCloseTo(0.5);
    expect(spotlight(SPOT_FAR)).toBe(0);
    expect(spotlight(200)).toBe(0);
  });
});
