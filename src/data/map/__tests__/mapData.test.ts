import { describe, it, expect } from 'vitest';
import buildings from '../buildings.json';
import pois from '../pois.json';
import index from '../rooms-index.json';

describe('bundled map data', () => {
  it('has 7 academic buildings each with a defaultFloorId', () => {
    expect(buildings.buildings).toHaveLength(7);
    for (const b of buildings.buildings) expect(b.defaultFloorId).not.toBeNull();
  });

  it('every room-index entry references a real building + floor', () => {
    const floorByBuilding = new Map(
      buildings.buildings.map((b) => [b.id, new Set(b.floors.map((f) => f.id))]),
    );
    for (const e of index as { buildingId: number; floorId: number; code: string }[]) {
      expect(floorByBuilding.has(e.buildingId)).toBe(true);
      expect(floorByBuilding.get(e.buildingId)!.has(e.floorId)).toBe(true);
      expect(e.code.length).toBeGreaterThan(0);
    }
  });

  it('POIs exclude the 7 academic-building pins (no double-draw)', () => {
    const names = new Set(buildings.buildings.map((b) => b.name));
    for (const f of pois.features) {
      expect(f.properties.type).not.toBe('indoor_building');
      if (f.properties.type === 'building') expect(names.has(f.properties.name)).toBe(false);
    }
  });

  it('includes Q (buildingId 0) — truthiness gotcha guard', () => {
    expect(buildings.buildings.some((b) => b.id === 0 && b.name === 'Q')).toBe(true);
  });
});
