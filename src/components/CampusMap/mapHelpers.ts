import type { RoomCategory, RoomIndexEntry, PoiFeature, MapSelection, Landmark } from '../../types/campusMap';

export interface RoomStyle { fill: string; stroke: string; }

// The campus basemap is ALWAYS light (CartoDB Positron) regardless of the app's
// DaisyUI theme, so these are fixed literals tuned to read on a light
// background — theme vars like --color-base-content flip to near-white in dark
// mode and vanish on the map. Soft fill + a matching stroke per category gives
// the legible, MyMENDELU-style floor plan (green teaching, beige corridors, …).
const CATEGORY_STYLE: Record<RoomCategory, RoomStyle> = {
  teaching:    { fill: '#c8e6a0', stroke: '#7cb342' },
  office:      { fill: '#cfe3f5', stroke: '#5a9bd4' },
  service:     { fill: '#f3d6e6', stroke: '#d98cb3' },
  circulation: { fill: '#ece1cb', stroke: '#cbb994' },
  structure:   { fill: '#e3e6ea', stroke: '#c2c8d0' },
  other:       { fill: '#e8edf2', stroke: '#c2c8d0' },
};

export function categoryStyle(c: RoomCategory): RoomStyle {
  return CATEGORY_STYLE[c] ?? CATEGORY_STYLE.other;
}

export function shortLabel(name: string): string {
  return name.match(/[NPS]\d+$/)?.[0] ?? name;
}

export function lonLatToLatLng(c: [number, number]): [number, number] {
  return [c[1], c[0]];
}

export function ringToLatLng(ring: number[][]): [number, number][] {
  return ring.map((c) => [c[1], c[0]] as [number, number]);
}

// Average of a ring's vertices, returned as [lon, lat] (data convention).
// Good enough for fly-to / cluster anchoring; not a true area centroid.
export function polygonCentroid(ring: number[][]): [number, number] {
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
}

// Bare letter+number room names (e.g. "Q01", "Q6", "A12") are the shared
// lecture halls / student rooms; dotted names ("Q01.43") are individual
// offices. Students search for the former, so they rank higher.
const BARE_HALL = /^[a-z]\d{1,3}$/;

// Rank a candidate against the query so the student sees the most relevant hit
// first: exact match (typing "Q01" → the room *named* Q01) → bare lecture hall
// prefix → other prefix → bare hall substring → loose substring.
function matchRank(q: string, name: string, code: string): number {
  const n = name.toLowerCase(), c = code.toLowerCase();
  const exact = n === q || c === q;
  const prefix = n.startsWith(q) || c.startsWith(q);
  const hall = BARE_HALL.test(n);
  if (exact) return 0;
  if (prefix && hall) return 1;
  if (prefix) return 2;
  if (hall) return 3;
  return 4;
}

export function searchPlaces(
  query: string, index: RoomIndexEntry[], pois: PoiFeature[], landmarks: Landmark[], limit = 12,
): MapSelection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rooms = index
    .filter((e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    .map((entry) => ({ sel: { kind: 'roomRef', entry } as MapSelection, rank: matchRank(q, entry.name, entry.code) }));
  const places = pois
    .filter((f) => f.properties.name.toLowerCase().includes(q))
    .map((f) => ({ sel: { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates } as MapSelection, rank: matchRank(q, f.properties.name, '') }));
  const lands = landmarks
    .filter((l) => l.name.toLowerCase().includes(q))
    .map((l) => ({ sel: { kind: 'landmark', landmark: l } as MapSelection, rank: matchRank(q, l.name, '') }));
  // Array.prototype.sort is stable, so equal-rank items keep their source order.
  return [...rooms, ...places, ...lands].sort((a, b) => a.rank - b.rank).map((x) => x.sel).slice(0, limit);
}
