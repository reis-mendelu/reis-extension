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

export function searchPlaces(
  query: string, index: RoomIndexEntry[], pois: PoiFeature[], limit = 12,
): MapSelection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rooms: MapSelection[] = index
    .filter((e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    .map((entry) => ({ kind: 'roomRef', entry }));
  const places: MapSelection[] = pois
    .filter((f) => f.properties.name.toLowerCase().includes(q))
    .map((f) => ({ kind: 'poi', poi: f.properties, coord: f.geometry.coordinates }));
  return [...rooms, ...places].slice(0, limit);
}
