import { describe, expect, it } from 'vitest';
import buildingsJson from '../buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { cutawayFor } from '../isoCutaway';
import { IMG } from '../isoView';

const buildings = (buildingsJson as BuildingsMeta).buildings;
const byName = (n: string) => buildings.find((b) => b.name === n)!;

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

  it('every building has a patch for each of its floors', () => {
    for (const b of buildings) {
      for (const f of b.floors) {
        expect(cutawayFor(b.id, f.level, 'summer'), `${b.name} level ${f.level}`).not.toBeNull();
      }
    }
  });

  it('a building whose levels start at 1 shares the ground patch with level 0 and below', () => {
    const B = byName('B');
    expect(cutawayFor(B.id, 1, 'summer')?.file).toBe(`cutaway/b${B.id}-1.webp`);
    expect(cutawayFor(B.id, -1, 'summer')?.file).toBe(`cutaway/b${B.id}-g.webp`);
  });

  it('is absent for a building without one, a level above the top, and any season but summer', () => {
    expect(cutawayFor(7, 2, 'summer')).toBeNull();
    expect(cutawayFor(0, 6, 'summer')).toBeNull();
    expect(cutawayFor(0, 2, 'winter')).toBeNull();
    expect(cutawayFor(0, 2, 'lights')).toBeNull();
  });
});
