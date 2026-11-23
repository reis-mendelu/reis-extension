import { describe, expect, it } from 'vitest';
import { ROOM_ENTRANCES } from '../roomEntrances';
import buildingsJson from '../buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';

const META = buildingsJson as BuildingsMeta;
const idOf = (name: string) => META.buildings.find((b) => b.name === name)!.id;

/** Only a door that is really on the building's side is a door: Q and B have one in the path data. */
describe('ROOM_ENTRANCES', () => {
  it('has the doors of Q and B, on the floor each building opens onto from the street', () => {
    expect(ROOM_ENTRANCES[idOf('Q')]?.level).toBe(0);
    expect(ROOM_ENTRANCES[idOf('B')]?.level).toBe(1);
  });

  it('has no door for a building whose path node is only the nearest one', () => {
    for (const n of ['A', 'C', 'E', 'M', 'X', 'Z']) expect(ROOM_ENTRANCES[idOf(n)]).toBeUndefined();
  });

  it('puts each door within a few metres of its building', () => {
    for (const n of ['Q', 'B']) {
      const b = META.buildings.find((x) => x.name === n)!;
      const door = ROOM_ENTRANCES[b.id]!;
      const lngs = b.outline.coordinates[0]!.map((p) => p[0]!);
      const lats = b.outline.coordinates[0]!.map((p) => p[1]!);
      expect(door.at[0]).toBeGreaterThan(Math.min(...lngs) - 0.0003);
      expect(door.at[0]).toBeLessThan(Math.max(...lngs) + 0.0003);
      expect(door.at[1]).toBeGreaterThan(Math.min(...lats) - 0.0003);
      expect(door.at[1]).toBeLessThan(Math.max(...lats) + 0.0003);
    }
  });
});
