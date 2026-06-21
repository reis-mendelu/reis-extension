import type { RoomCategory, RoomIndexEntry, PoiFeature, MapSelection } from '../../types/campusMap';

const COLOR_VARS: Record<RoomCategory, string> = {
  teaching: '--color-warning',
  office: '--color-info',
  service: '--color-base-300',
  circulation: '--color-success',
  structure: '--color-base-200',
  other: '--color-secondary',
};

export function categoryColorVar(c: RoomCategory): string {
  return COLOR_VARS[c] ?? COLOR_VARS.other;
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
  query: string, index: RoomIndexEntry[], pois: PoiFeature[], limit = 12,
): MapSelection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rooms = index
    .filter((e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    .map((entry) => ({ sel: { kind: 'roomRef', entry } as MapSelection, rank: matchRank(q, entry.name, entry.code) }));
  const places = pois
    .filter((f) => f.properties.name.toLowerCase().includes(q))
    .map((f) => ({ sel: { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates } as MapSelection, rank: matchRank(q, f.properties.name, '') }));
  // Array.prototype.sort is stable, so equal-rank items keep their source order.
  return [...rooms, ...places].sort((a, b) => a.rank - b.rank).map((x) => x.sel).slice(0, limit);
}
