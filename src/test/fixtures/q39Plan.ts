import type { RoomFeature, RoomsCollection } from '../../types/campusMap';

const LNG0 = 16.6142;
const LAT0 = 49.2096;
const at = (x: number, y: number): [number, number] => [
  LNG0 + x / (111320 * Math.cos((LAT0 * Math.PI) / 180)),
  LAT0 + y / 111320,
];

/** A 4 × 4 m shape at (x, y) metres from the anchor, in building Q. */
function shape(
  id: number,
  x: number,
  y: number,
  level: number,
  type: string,
  name = ''
): RoomFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[at(x, y), at(x + 4, y), at(x + 4, y + 4), at(x, y + 4), at(x, y)]],
    },
    properties: {
      id,
      buildingId: 0,
      floorId: level,
      floorLevel: level,
      name,
      nickname: null,
      type,
      category: 'teaching',
      label: type,
      passportNumber: null,
      seats: null,
      hasProjector: false,
      hasWhiteboard: false,
      code: null,
    },
  };
}

/** Room 171 in Q's id space. */
export const Q39_ID = 171;

/**
 * A plan room directions can route: Q39 on floor 3, a staircase beside it from
 * the entrance floor up, and two offices that give the building its extent.
 * Shared by the directions tests and the dormancy guard.
 */
export function q39Plan(): { q39: RoomFeature; rooms: RoomsCollection } {
  const q39 = shape(Q39_ID, -40, 10, 3, 'classroom', 'Q39');
  const features = [
    q39,
    ...[0, 1, 2, 3].map((l) => shape(900 + l, -44, 10, l, 'stairs')),
    shape(950, -50, -30, 0, 'office'),
    shape(951, 50, 30, 0, 'office'),
  ];
  return { q39, rooms: { type: 'FeatureCollection', features } as RoomsCollection };
}
