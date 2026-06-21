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

// Rank a candidate against the query so the student sees the most relevant hit
// first: an exact match (typing "Q01" → the room *named* Q01, not its Q01.NN
// children), then prefix matches, then loose substring matches.
function matchRank(q: string, ...fields: string[]): number {
  const f = fields.map((s) => s.toLowerCase());
  if (f.some((s) => s === q)) return 0;
  if (f.some((s) => s.startsWith(q))) return 1;
  return 2;
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
    .map((f) => ({ sel: { kind: 'poi', poi: f.properties, coord: f.geometry.coordinates } as MapSelection, rank: matchRank(q, f.properties.name) }));
  // Array.prototype.sort is stable, so equal-rank items keep their source order.
  return [...rooms, ...places].sort((a, b) => a.rank - b.rank).map((x) => x.sel).slice(0, limit);
}
