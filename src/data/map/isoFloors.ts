import type { Building } from '../../types/campusMap';
import { IMG, isoPixel } from './isoView';
import { ISO_BUILDINGS } from './isoBuildings';

/**
 * Where a building's floors stand in the picture. A floor is a plate at its height above the
 * ground; the rest of the building above it is what a student must "see through". The numbers
 * are in isoBuildings.ts; a building without any stands on the 17 m ground with a typical storey.
 */
const TYPICAL_FLOOR_M = 3.2;

export function floorHeights(b: Pick<Building, 'id' | 'floors'>) {
  const known = ISO_BUILDINGS[b.id];
  if (known) return known;
  const levels = b.floors.map((f) => f.level);
  const top = Math.max(0, ...levels);
  const lowest = Math.min(...levels.filter((l) => l >= 0), top);
  return {
    groundM: 0,
    baseM: 0,
    floorM: TYPICAL_FLOOR_M,
    roofM: (top - lowest + 1) * TYPICAL_FLOOR_M,
    lowest,
    top,
  };
}

/** A ring of [lng, lat] as picture pixels, lifted `heightM` above the ground. */
export function isoRing(ring: number[][], heightM: number): [number, number][] {
  return ring.map(([lng, lat]) => {
    const { px, py } = isoPixel(lat!, lng!, heightM);
    return [px, py];
  });
}

export const svgPath = (rings: [number, number][][]) =>
  rings.map((r) => `M${r.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`).join('');

/**
 * The building above a floor, as the faces that make up its silhouette: every wall from the
 * plate up to the roof, and the roof. Painted as one translucent group they read as the upper
 * floors seen through frosted glass.
 */
export function volumeAbove(ring: number[][], fromM: number, toM: number): [number, number][][] {
  const lo = isoRing(ring, fromM);
  const hi = isoRing(ring, toM);
  const walls = lo.slice(0, -1).map((a, i) => [a, lo[i + 1]!, hi[i + 1]!, hi[i]!]);
  return [...walls, hi];
}

export function inRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is this picture pixel on the building (its footprint, its roof, or a wall between)? */
export function onBuilding(
  x: number,
  y: number,
  ring: number[][],
  roofM: number,
  groundM = 0
): boolean {
  return volumeAbove(ring, groundM, roofM).some((face) => inRing(x, y, face));
}

/**
 * Where to look to see a whole building, floors and roof: its middle (halfway up) and an
 * OpenSeadragon zoom at which it fills most of a screen of this shape (width / height).
 */
export function frameBuilding(b: Pick<Building, 'id' | 'floors' | 'outline'>, aspect: number) {
  const ring = b.outline.coordinates[0]!;
  const { groundM, roofM } = floorHeights(b);
  const pts = [...isoRing(ring, groundM), ...isoRing(ring, roofM)];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margin = 1.5;
  const visible = Math.max((x1 - x0) * margin, (y1 - y0) * margin * aspect);
  return { x: (x0 + x1) / 2 / IMG.w, y: (y0 + y1) / 2 / IMG.w, zoom: IMG.w / visible };
}

/**
 * A ruler up the building's nearest corner: where each floor's slab meets it, from the lowest
 * floor at or above the ground up to `upTo`. Read like the markings on a doorframe, it says
 * "this is the 4th floor" by counting the storeys under it, with no need to know the numbering.
 */
export function floorTicks(b: Pick<Building, 'id' | 'floors' | 'outline'>, upTo: number) {
  const { baseM, floorM, lowest } = floorHeights(b);
  const ring = b.outline.coordinates[0]!;
  // The corner nearest the camera: lowest on the page.
  const [lng, lat] = ring.reduce((a, p) => (p[1]! < a[1]! ? p : a));
  return b.floors
    .filter((f) => f.level >= lowest && f.level <= upTo)
    .sort((a, c) => a.level - c.level)
    .map((f) => ({
      level: f.level,
      name: f.name,
      ...isoPixel(lat!, lng!, baseM + (f.level - lowest) * floorM),
    }));
}
