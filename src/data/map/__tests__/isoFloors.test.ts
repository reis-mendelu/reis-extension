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
  it('Q is measured: six storeys under 17.8 m, other buildings get a typical storey', () => {
    expect(floorHeights(Q)).toEqual({ floorM: 2.97, roofM: 17.8 });
    const other = floorHeights({ id: 99, floors: [{ id: 1, level: 3, name: '3', roomCount: 1 }] });
    expect(other.roofM).toBeCloseTo(4 * 3.2);
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
