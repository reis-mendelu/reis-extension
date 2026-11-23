import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta, RoomFeature, RoomsCollection } from '../../types/campusMap';

/** Building Q with one small room on its fourth floor, for the isometric map's floor tests. */
export const Q = (buildingsJson as BuildingsMeta).buildings.find((b) => b.name === 'Q')!;
export const fourth = Q.floors.find((f) => f.level === 4)!;
const [x0, y0] = Q.outline.coordinates[0]![0]!;
// A small room just inside the footprint's first corner.
const ring = [
  [x0!, y0!],
  [x0! + 0.00004, y0!],
  [x0! + 0.00004, y0! + 0.00003],
  [x0!, y0! + 0.00003],
  [x0!, y0!],
];
export const room = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring] },
  properties: {
    id: 4101,
    buildingId: 0,
    floorId: fourth.id,
    floorLevel: 4,
    name: 'Q4.01',
    type: 'classroom',
    category: 'teaching',
    label: 'Q4.01',
    passportNumber: null,
    seats: 20,
    hasProjector: false,
    hasWhiteboard: false,
    code: null,
  },
} as unknown as RoomFeature;
export const rooms = { type: 'FeatureCollection', features: [room] } as RoomsCollection;

// A stairwell on the same floor: 2.5 m by 6 m, so it is drawn as steps.
const [sx, sy] = [x0! + 0.00008, y0! + 0.00002];
export const stairs = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [sx, sy],
        [sx + 0.000034, sy],
        [sx + 0.000034, sy + 0.000054],
        [sx, sy + 0.000054],
        [sx, sy],
      ],
    ],
  },
  properties: {
    ...room.properties,
    id: 4102,
    name: 'Q4.S1',
    type: 'stairs',
    category: 'circulation',
    label: 'Q4.S1',
  },
} as unknown as RoomFeature;
export const stairRooms = {
  type: 'FeatureCollection',
  features: [room, stairs],
} as RoomsCollection;
