import { describe, it, expect } from 'vitest';
import buildings from '../buildings.json';
import pois from '../pois.json';
import index from '../rooms-index.json';
import remotePlaces from '../remotePlaces.json';
import type { RemotePlace } from '../../../types/campusMap';

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

  it('remote places: 4 sites with unique ids, closed footprints in South Moravia, and a url', () => {
    const places = (remotePlaces as { places: RemotePlace[] }).places;
    expect(places).toHaveLength(4);
    expect(new Set(places.map((p) => p.id)).size).toBe(4);
    for (const p of places) {
      expect(p.id).toBeLessThan(0); // synthetic, never collides with real ids
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.shortName.length).toBeGreaterThan(0);
      expect(p.url).toMatch(/^https:\/\//);
      // Optional grounds boundary (arboretum garden) is a closed ring.
      if (p.area) {
        const a = p.area.coordinates[0];
        expect(a.length).toBeGreaterThanOrEqual(4);
        expect(a[0]).toEqual(a[a.length - 1]);
      }
      // One polygon, or a MultiPolygon of buildings (Lednice, arboretum) — check every ring.
      const rings = p.outline.type === 'MultiPolygon'
        ? p.outline.coordinates.map((poly) => poly[0])
        : [p.outline.coordinates[0]];
      expect(rings.length).toBeGreaterThan(0);
      let sx = 0, sy = 0, n = 0;
      for (const ring of rings) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]); // ring is closed
        for (const [x, y] of ring) { sx += x; sy += y; n++; }
      }
      // Overall footprint centre lands in South Moravia (lon ~16, lat ~48–50).
      expect(sx / n).toBeGreaterThanOrEqual(16);
      expect(sx / n).toBeLessThanOrEqual(17);
      expect(sy / n).toBeGreaterThanOrEqual(48);
      expect(sy / n).toBeLessThanOrEqual(50);
      // Optional inner-map detail (arboretum): footpaths are polylines, POIs are
      // named points in the same region.
      if (p.paths) for (const path of p.paths) expect(path.length).toBeGreaterThanOrEqual(2);
      if (p.pois) for (const poi of p.pois) {
        expect(poi.name.length).toBeGreaterThan(0);
        expect(poi.lon).toBeGreaterThanOrEqual(16);
        expect(poi.lon).toBeLessThanOrEqual(17);
        expect(poi.lat).toBeGreaterThanOrEqual(48);
        expect(poi.lat).toBeLessThanOrEqual(50);
      }
    }
  });
});
