import { describe, it, expect } from 'vitest';
import buildings from '../buildings.json';
import pois from '../pois.json';
import index from '../rooms-index.json';
import remotePlaces from '../remotePlaces.json';
import type { RemotePlace } from '../../../types/campusMap';
import { pointInRing } from './pointInRing';

/** Mean of a ring's vertices — good enough for a convex-ish building footprint. */
function centroid(ring: number[][]): number[] {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0]!;
    y += p[1]!;
  }
  return [x / ring.length, y / ring.length];
}

describe('bundled map data', () => {
  // Seven from the MENDELU survey plus budova Z (FRRMS), curated in reis-data
  // (source/curated/Z) because the survey never covered it.
  it('has 8 academic buildings (7 surveyed + curated Z) each with a defaultFloorId', () => {
    expect(buildings.buildings).toHaveLength(8);
    for (const b of buildings.buildings) expect(b.defaultFloorId).not.toBeNull();
  });

  it('every room-index entry references a real building + floor', () => {
    const floorByBuilding = new Map(
      buildings.buildings.map((b) => [b.id, new Set(b.floors.map((f) => f.id))])
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

  /**
   * Panská lícha is the one entry that is not MENDELU property — a private
   * equestrian centre where combined-study practicals are held, added because
   * the map serves students who have to get there, not a property register
   * (student feedback, 2026-09-15). It must keep a drawable riding hall and the
   * areal boundary behind it, and the picker section must not call it a MENDELU
   * workplace. See docs/superpowers/specs/2026-07-05-mendelu-remote-places-map-design.md.
   */
  it('keeps Panská lícha drawable: riding-hall outline inside its areal boundary', () => {
    const places = (remotePlaces as { places: RemotePlace[] }).places;
    const licha = places.find((p) => p.id === -105);
    expect(licha, 'Panská lícha (-105) is missing').toBeDefined();
    expect(licha!.area, 'the areal boundary is what gives the hall context').toBeDefined();
    // The hall itself, not the whole farmyard — a student needs a building.
    const rings =
      licha!.outline.type === 'MultiPolygon'
        ? licha!.outline.coordinates.map((poly) => poly[0]!)
        : [licha!.outline.coordinates[0]!];
    expect(rings).toHaveLength(1);
    expect(rings[0]!.length).toBeGreaterThanOrEqual(4);
    // Brno-Obřany, ~4 km NE of the Černá Pole campus.
    for (const [lon, lat] of rings[0]!) {
      expect(lat).toBeGreaterThan(49.24);
      expect(lat).toBeLessThan(49.25);
      expect(lon).toBeGreaterThan(16.63);
      expect(lon).toBeLessThan(16.64);
    }

    // The point of picking the ring that ENCLOSES the hall rather than the
    // largest one: the relation has two outer rings and only one contains the
    // building. A bbox check cannot tell those apart — both sit in Obřany — so
    // assert containment directly, or the very failure `ringContaining` exists
    // to prevent would sail through this test.
    const ring = licha!.area!.coordinates[0]!;
    expect(pointInRing(centroid(rings[0]!), ring)).toBe(true);
    // And every corner of the hall, not just its middle.
    for (const corner of rings[0]!) expect(pointInRing(corner, ring)).toBe(true);
  });

  it('includes Q (buildingId 0) — truthiness gotcha guard', () => {
    expect(buildings.buildings.some((b) => b.id === 0 && b.name === 'Q')).toBe(true);
  });

  // Nine since 2026-09-25 (the Útěchov wood-science centre); eight since
  // 2026-09-24, when Karlov, SLŠ Hranice and VOŠ Boskovice joined as the
  // IS "areály" with classrooms that had no pin. Karlov (Jeseníky, Silesia) and
  // Hranice (Olomouc region) are why the box below is Moravia-Silesia, not
  // South Moravia, and Karlov has no website of its own.
  it('remote places: 9 sites with unique ids, closed footprints in Moravia-Silesia, url https or none', () => {
    const places = (remotePlaces as { places: RemotePlace[] }).places;
    expect(places).toHaveLength(9);
    expect(new Set(places.map((p) => p.id)).size).toBe(9);
    for (const p of places) {
      expect(p.id).toBeLessThan(0); // synthetic, never collides with real ids
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.shortName.length).toBeGreaterThan(0);
      if (p.url !== null) expect(p.url).toMatch(/^https:\/\//);
      // Optional grounds boundary (arboretum garden) is a closed ring.
      if (p.area) {
        const a = p.area.coordinates[0]!; // safe: GeoJSON Polygon always has >=1 ring
        expect(a.length).toBeGreaterThanOrEqual(4);
        expect(a[0]).toEqual(a[a.length - 1]);
      }
      // One polygon, or a MultiPolygon of buildings (Lednice, arboretum) — check every ring.
      // safe: GeoJSON (Multi)Polygon coordinates always have >=1 ring at index 0
      const rings =
        p.outline.type === 'MultiPolygon'
          ? p.outline.coordinates.map((poly) => poly[0]!)
          : [p.outline.coordinates[0]!];
      expect(rings.length).toBeGreaterThan(0);
      let sx = 0,
        sy = 0,
        n = 0;
      for (const ring of rings) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]); // ring is closed
        // safe: GeoJSON positions are always [lon, lat] pairs
        for (const [x, y] of ring) {
          sx += x!;
          sy += y!;
          n++;
        }
      }
      // Overall footprint centre lands in Moravia-Silesia (lon 16–18, lat 48–50.3).
      expect(sx / n).toBeGreaterThanOrEqual(16);
      expect(sx / n).toBeLessThanOrEqual(18);
      expect(sy / n).toBeGreaterThanOrEqual(48);
      expect(sy / n).toBeLessThanOrEqual(50.3);
      // Optional inner-map detail (arboretum): footpaths are polylines, POIs are
      // named points in the same region.
      if (p.paths) for (const path of p.paths) expect(path.length).toBeGreaterThanOrEqual(2);
      if (p.pois)
        for (const poi of p.pois) {
          expect(poi.name.length).toBeGreaterThan(0);
          expect(poi.lon).toBeGreaterThanOrEqual(16);
          expect(poi.lon).toBeLessThanOrEqual(17);
          expect(poi.lat).toBeGreaterThanOrEqual(48);
          expect(poi.lat).toBeLessThanOrEqual(50);
        }
    }
  });
});

describe('room index: the two building-M ghosts stay out', () => {
  const rows = index as { code: string; name: string; nickname: string | null }[];

  // Regenerated upstream from IS Mendelu, so IS will keep handing these back;
  // this is what catches them coming home with the next refresh.
  it("has no BA27N1074 / BA27N1075 — open air between M's wings, not rooms", () => {
    expect(rows.filter((e) => e.code === 'BA27N1074' || e.code === 'BA27N1075')).toEqual([]);
  });

  it('keeps the real N1074/N1075 halls in A and B', () => {
    // A and B only: budova Z has its own N1075 (the 1.NP atrium), unrelated to M's ghosts.
    const kept = rows.filter((e) => /^BA\d\dN107[45]$/.test(e.code));
    expect(kept.map((e) => e.code).sort()).toEqual([
      'BA01N1074',
      'BA01N1075',
      'BA04N1074',
      'BA04N1075',
    ]);
    expect(kept.map((e) => e.nickname).sort()).toEqual(['A121', 'B4', 'B5', null]);
  });
});
