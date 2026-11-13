import { describe, it, expect } from 'vitest';
import { SPORT_PLACES, SPORT_BOUNDS } from '../sportPlaces';
import buildingsJson from '../../../data/map/buildings.json';

/**
 * The seven Sportera places Dominik picked on 2026-11-13, by their public
 * Sportera page. Listed here by hand, from sportera.cz/city/brno, so a typo in
 * the data file cannot pass by agreeing with itself.
 */
const CHOSEN = [
  'https://sportera.cz/place/workout/f650-workout-bieblova',
  'https://sportera.cz/place/basketbal/66b9-basket-trida-generala-piky',
  'https://sportera.cz/place/basketbal/bfs-basketbal-schreberovy-zahradky',
  'https://sportera.cz/place/fotbal/bfs-fotbal-schreberovy-zahradky',
  'https://sportera.cz/place/workout/wor-luzanecka',
  'https://sportera.cz/place/pingpong/e6d5-ping-pong-u-cukrarny',
  'https://sportera.cz/place/pingpong/a7fb-ping-pong-luzanky',
];

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
function metres(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function centroid(name: string): [number, number] {
  const b = (
    buildingsJson as { buildings: { name: string; outline: { coordinates: number[][][] } }[] }
  ).buildings.find((x) => x.name === name);
  if (!b) throw new Error(`no building ${name}`);
  const ring = b.outline.coordinates[0]!;
  const lng = ring.reduce((s, p) => s + p[0]!, 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1]!, 0) / ring.length;
  return [lng, lat];
}

describe('SPORT_PLACES', () => {
  it('is exactly the seven chosen places, each once', () => {
    expect(SPORT_PLACES.map((p) => p.url).sort()).toEqual([...CHOSEN].sort());
    expect(new Set(SPORT_PLACES.map((p) => p.id)).size).toBe(7);
  });

  it('sits every place in Brno', () => {
    for (const p of SPORT_PLACES) {
      expect(p.coord[0]).toBeGreaterThan(16.4);
      expect(p.coord[0]).toBeLessThan(16.8);
      expect(p.coord[1]).toBeGreaterThan(49.1);
      expect(p.coord[1]).toBeLessThan(49.3);
    }
  });

  it('names a nearest building whose distance matches the coordinates within 30 m', () => {
    for (const p of SPORT_PLACES) {
      const actual = metres(p.coord, centroid(p.near.building));
      expect(Math.abs(actual - p.near.metres), p.id).toBeLessThan(30);
    }
  });

  it('bounds every place', () => {
    const [[south, west], [north, east]] = SPORT_BOUNDS;
    for (const p of SPORT_PLACES) {
      expect(p.coord[1]).toBeGreaterThanOrEqual(south);
      expect(p.coord[1]).toBeLessThanOrEqual(north);
      expect(p.coord[0]).toBeGreaterThanOrEqual(west);
      expect(p.coord[0]).toBeLessThanOrEqual(east);
    }
  });
});
