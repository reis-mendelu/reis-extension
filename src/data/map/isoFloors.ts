import type { Building } from '../../types/campusMap';
import { IMG, isoPixel } from './isoView';

/**
 * Where a building's floors stand in the picture. A floor is a plate at its height above the
 * ground; the rest of the building above it is what a student must "see through".
 *
 * Q's numbers are the render's own model (heights above the terrain): the entrance level sits
 * on a 3.3 m plinth, storeys are 3.55 m, and the south wing's roof is 24.7 m. Other buildings
 * get a typical storey standing on the ground and are drawn the same way; their real heights
 * can replace the guess one building at a time.
 */
const MEASURED: Readonly<Record<number, { baseM: number; floorM: number; roofM: number }>> = {
  0: { baseM: 3.3, floorM: 3.55, roofM: 24.7 },
};
const TYPICAL_FLOOR_M = 3.2;

export function floorHeights(b: Pick<Building, 'id' | 'floors'>) {
  const known = MEASURED[b.id];
  if (known) return known;
  const top = Math.max(0, ...b.floors.map((f) => f.level));
  return { baseM: 0, floorM: TYPICAL_FLOOR_M, roofM: (top + 1) * TYPICAL_FLOOR_M };
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
export function onBuilding(x: number, y: number, ring: number[][], roofM: number): boolean {
  return volumeAbove(ring, 0, roofM).some((face) => inRing(x, y, face));
}

/**
 * Where to look to see a whole building, floors and roof: its middle (halfway up) and an
 * OpenSeadragon zoom at which it fills most of a screen of this shape (width / height).
 */
export function frameBuilding(b: Pick<Building, 'id' | 'floors' | 'outline'>, aspect: number) {
  const ring = b.outline.coordinates[0]!;
  const pts = [...isoRing(ring, 0), ...isoRing(ring, floorHeights(b).roofM)];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margin = 1.5;
  const visible = Math.max((x1 - x0) * margin, (y1 - y0) * margin * aspect);
  return { x: (x0 + x1) / 2 / IMG.w, y: (y0 + y1) / 2 / IMG.w, zoom: IMG.w / visible };
}
