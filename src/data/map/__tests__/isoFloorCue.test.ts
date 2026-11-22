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
  it('names the floor as a student says it, and what to do', () => {
    expect(cueText(4, 'cz')).toEqual({ title: '4. patro', action: '4 patra nahoru' });
    expect(cueText(0, 'cz')).toEqual({ title: 'přízemí', action: null });
  });

  it('uses the right Czech plural', () => {
    expect(cueText(1, 'cz').action).toBe('1 patro nahoru');
    expect(cueText(2, 'cz').action).toBe('2 patra nahoru');
    expect(cueText(5, 'cz').action).toBe('5 pater nahoru');
    expect(cueText(-1, 'cz').action).toBe('1 patro dolů');
    expect(cueText(-2, 'cz').action).toBe('2 patra dolů');
  });

  it('speaks English too', () => {
    expect(cueText(1, 'en').action).toBe('1 floor up');
    expect(cueText(3, 'en').action).toBe('3 floors up');
    expect(cueText(-1, 'en').action).toBe('1 floor down');
  });
});
