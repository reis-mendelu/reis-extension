import type { PathOptions } from 'leaflet';
import type { RoomCategory, RoomIndexEntry, PoiFeature, MapSelection, Landmark } from '../../types/campusMap';

export interface RoomStyle { fill: string; stroke: string; }

// Leaflet polygon styles for the map. Fixed literals (the basemap is always
// light) kept here with categoryStyle so all map styling lives in one place.
// SELECTED = MyMENDELU-style solid orange (brand colors are green, so orange
// stands out). BUILDING/SIBLING = blue "clickable building" tint; siblings are
// fainter (base-content outlines were invisible in the dark app theme).
export const SELECTED_STYLE: PathOptions = {
  color: '#ea580c', weight: 3, fillColor: '#fb923c', fillOpacity: 0.85, bubblingMouseEvents: false,
};
export const STRUCTURE_STYLE: PathOptions = {
  color: '#c2c8d0', weight: 0.8, fillColor: '#e3e6ea', fillOpacity: 0.5,
  interactive: false, bubblingMouseEvents: false,
};
export const BUILDING_STYLE: PathOptions = {
  color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.25, bubblingMouseEvents: false,
};
export const SIBLING_STYLE: PathOptions = {
  color: '#2563eb', weight: 1.5, fillColor: '#3b82f6', fillOpacity: 0.1, bubblingMouseEvents: false,
};

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

// Rough planar distance in metres between two [lon, lat] points — exact enough
// for the ~tens-of-metres landmark grouping below.
function metersBetween(a: [number, number], b: [number, number]): number {
  const dx = (a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180) * 111320;
  const dy = (a[1] - b[1]) * 111320;
  return Math.hypot(dx, dy);
}

// Some landmarks are literally the same building under two IS identities: FRRMS
// and Kolej Akademie have an identical outline. Those get a combined "A / B"
// label so a hover/detail reveals both names. The threshold is tiny on purpose
// (≈ identical centroid): merely adjacent buildings — Tauferovy koleje and the
// sports centre (~35 m apart), the JAK blocks (65 m+) — are SEPARATE and must
// keep their own names. Grouping is transitive. Returns a landmark-id → label map.
export function landmarkGroupLabels(landmarks: Landmark[], thresholdM = 5): Map<number, string> {
  // polygonCentroid is a vertex average, so a duplicated closing vertex skews it
  // toward that point — and two identical buildings stored with different start
  // vertices would then get different centroids and fail to merge. Drop the
  // closing duplicate first so identical outlines always centroid-match.
  const cents = landmarks.map((l) => {
    const ring = l.outline.coordinates[0];
    const last = ring[ring.length - 1];
    const open = ring.length > 1 && ring[0][0] === last[0] && ring[0][1] === last[1]
      ? ring.slice(0, -1)
      : ring;
    return polygonCentroid(open);
  });
  const parent = landmarks.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < landmarks.length; i++) {
    for (let j = i + 1; j < landmarks.length; j++) {
      if (metersBetween(cents[i], cents[j]) <= thresholdM) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  landmarks.forEach((_, i) => {
    const root = find(i);
    const members = groups.get(root);
    if (members) members.push(i);
    else groups.set(root, [i]);
  });
  const labels = new Map<number, string>();
  for (const members of groups.values()) {
    const text = members.map((i) => landmarks[i].name).join(' / ');
    for (const i of members) labels.set(landmarks[i].id, text);
  }
  return labels;
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
