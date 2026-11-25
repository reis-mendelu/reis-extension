import { describe, expect, it } from 'vitest';
import buildingsJson from '../buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import {
  floorHeights,
  frameBuilding,
  inRing,
  isoRing,
  onBuilding,
  volumeAbove,
} from '../isoFloors';
import { isoPixel } from '../isoView';

const Q = (buildingsJson as BuildingsMeta).buildings.find((b) => b.name === 'Q')!;
const IMG_W = 11535;
const ring = Q.outline.coordinates[0]!;

describe('floors in the isometric picture', () => {
  it('Q is measured (a 3.3 m plinth, 3.55 m storeys, a 24.7 m roof); a building we know nothing of gets a typical storey on the ground', () => {
    expect(floorHeights(Q)).toMatchObject({ baseM: 3.64, floorM: 3.55, roofM: 25.04, lowest: 0 });
    const other = floorHeights({ id: 99, floors: [{ id: 1, level: 3, name: '3', roomCount: 1 }] });
    expect(other).toMatchObject({ groundM: 0, baseM: 0, floorM: 3.2, lowest: 3, top: 3 });
    expect(other.roofM).toBeCloseTo(3.2);
  });

  it('every building has its own numbers, and its floors stack upward from its lowest above-ground level', () => {
    for (const b of (buildingsJson as BuildingsMeta).buildings) {
      const h = floorHeights(b);
      expect(h.roofM, b.name).toBeGreaterThan(h.baseM);
      expect(h.top, b.name).toBe(Math.max(...b.floors.map((f) => f.level)));
      expect(
        b.floors.some((f) => f.level === h.lowest),
        b.name
      ).toBe(true);
    }
  });

  it('a higher floor sits higher on the page, by height × cos 45° / 0.2 m per pixel', () => {
    const ground = isoPixel(49.2096, 16.6142, 0);
    const fourth = isoPixel(49.2096, 16.6142, 4 * 2.97);
    expect(ground.py - fourth.py).toBeCloseTo((4 * 2.97 * Math.SQRT1_2) / 0.2, 3);
    expect(fourth.px).toBeCloseTo(ground.px, 6); // straight up, not sideways
  });

  it('the volume above a floor is a wall per edge plus the roof, and covers the roof but not the street', () => {
    const faces = volumeAbove(ring, 4 * 2.97, 17.8);
    expect(faces).toHaveLength(ring.length); // (n - 1) walls + roof
    const roof = isoRing(ring, 17.8);
    const cx = roof.reduce((a, p) => a + p[0], 0) / roof.length;
    const cy = roof.reduce((a, p) => a + p[1], 0) / roof.length;
    expect(inRing(cx, cy, roof) || onBuilding(cx, cy, ring, 17.8)).toBe(true);
    expect(onBuilding(cx, cy - 4000, ring, 17.8)).toBe(false);
  });

  it('frames a whole building: Q fills most of a phone screen, centred between its footprint and roof', () => {
    const f = frameBuilding(Q, 390 / 844);
    // The building is ~700 picture px wide here, and the view shows ~1.5x that.
    expect(IMG_W / f.zoom).toBeGreaterThan(600);
    expect(IMG_W / f.zoom).toBeLessThan(2500);
    const foot = isoRing(ring, 0);
    const roof = isoRing(ring, 17.8);
    const ys = [...foot, ...roof].map((p) => p[1]);
    expect(f.y * IMG_W).toBeGreaterThan(Math.min(...ys));
    expect(f.y * IMG_W).toBeLessThan(Math.max(...ys));
    // A wide screen has less height to spare, so it zooms out more than a tall one.
    expect(frameBuilding(Q, 1.6).zoom).toBeLessThanOrEqual(f.zoom);
  });
});
