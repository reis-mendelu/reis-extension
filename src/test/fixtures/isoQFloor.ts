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
