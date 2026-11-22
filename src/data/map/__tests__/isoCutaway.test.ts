import { describe, expect, it } from 'vitest';
import { cutawayFor } from '../isoCutaway';
import { IMG } from '../isoView';

describe('cut-off patches of the picture', () => {
  it('Q has one for each of its levels, and one shared by everything below the ground', () => {
    expect(cutawayFor(0, 0, 'summer')?.file).toBe('cutaway/b0-0.webp');
    expect(cutawayFor(0, 5, 'summer')?.file).toBe('cutaway/b0-5.webp');
    expect(cutawayFor(0, -1, 'summer')?.file).toBe('cutaway/b0-g.webp');
    expect(cutawayFor(0, -2, 'summer')?.file).toBe('cutaway/b0-g.webp');
  });

  it('sits where it was rendered, in OpenSeadragon units (the picture is 1 wide)', () => {
    expect(cutawayFor(0, 2, 'summer')).toMatchObject({
      x: 5512 / IMG.w,
      y: 5207 / IMG.w,
      width: 584 / IMG.w,
    });
  });

  it('is absent for a building without one, a level above the top, and any season but summer', () => {
    expect(cutawayFor(7, 2, 'summer')).toBeNull();
    expect(cutawayFor(0, 6, 'summer')).toBeNull();
    expect(cutawayFor(0, 2, 'winter')).toBeNull();
    expect(cutawayFor(0, 2, 'lights')).toBeNull();
  });
});
