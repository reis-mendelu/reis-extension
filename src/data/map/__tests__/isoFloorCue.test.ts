import { describe, expect, it } from 'vitest';
import buildingsJson from '../buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { cueText, floorCue } from '../isoFloorCue';

const META = (buildingsJson as BuildingsMeta).buildings;
const byName = (n: string) => META.find((b) => b.name === n)!;

/**
 * What tells a student which floor is open in the isometric picture: how many floors up from the
 * ground it is (counted, so a building that numbers its ground floor 1 still says "up 2" for floor 3).
 */
describe('floorCue', () => {
  it('counts floors up from the lowest floor above ground', () => {
    expect(floorCue(byName('Q'), 4).up).toBe(4);
    // B numbers its ground floor 1: floor 3 is two floors up, not three.
    expect(floorCue(byName('B'), 3).up).toBe(2);
    expect(floorCue(byName('B'), 1).up).toBe(0);
  });

  it('counts a basement as down', () => {
    expect(floorCue(byName('Q'), -1).up).toBe(-1);
  });

  it('puts the label at the corner nearest the camera, at the open floor', () => {
    const low = floorCue(byName('Q'), 1).corner;
    const high = floorCue(byName('Q'), 4).corner;
    expect(high.px).toBeCloseTo(low.px, 6);
    expect(high.py).toBeLessThan(low.py);
  });
});

describe('cueText', () => {
  it('names the floor as a student says it, and says nothing about up or down', () => {
    expect(cueText(4, 'cz')).toBe('4. patro');
    expect(cueText(0, 'cz')).toBe('přízemí');
    expect(cueText(-1, 'cz')).toBe('1. podzemní podlaží');
    expect(cueText(2, 'en')).toBe('floor 2');
  });
});
