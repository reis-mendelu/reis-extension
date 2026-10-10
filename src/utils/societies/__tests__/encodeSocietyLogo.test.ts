import { describe, it, expect } from 'vitest';
import { squareCrop, LOGO_SIDE } from '../encodeSocietyLogo';

describe('squareCrop', () => {
  it('centres a square on a wide image', () => {
    expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
  });
  it('centres a square on a tall image', () => {
    expect(squareCrop(200, 500)).toEqual({ sx: 0, sy: 150, side: 200 });
  });
  it('leaves a square alone', () => {
    expect(squareCrop(300, 300)).toEqual({ sx: 0, sy: 0, side: 300 });
  });
  it('targets 256px', () => {
    expect(LOGO_SIDE).toBe(256);
  });
});
