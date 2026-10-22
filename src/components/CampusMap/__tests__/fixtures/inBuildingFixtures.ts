import type { MapEvent } from '../../../../types/events';
import type { RoomFeature, RoomsCollection } from '../../../../types/campusMap';

// Q (buildings.json id 0): Q02 is floor 5 (ground, level 0), placeId 599.
export const Q = 0;
export const Q02_FLOOR = 5;
export const Q_OTHER_FLOOR = 4;
// Its building centre, which is where locateEvent puts a Q02 event's coord.
export const BUILDING_CENTRE: [number, number] = [16.6142, 49.2096];
// Where the room itself is drawn: deliberately NOT the building centre.
const ROOM_RING = [
  [16.615, 49.21],
  [16.6152, 49.21],
  [16.6152, 49.2102],
  [16.615, 49.2102],
];

export function room(id: number, floorId: number, floorLevel: number): RoomFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ROOM_RING] },
    properties: {
      id,
      buildingId: Q,
      floorId,
      floorLevel,
      name: 'Q02',
      type: 'lecture',
      category: 'classroom',
      label: 'Q02',
      passportNumber: 'BA39N1010',
      seats: null,
      hasProjector: false,
      hasWhiteboard: false,
      code: null,
    },
  } as unknown as RoomFeature;
}
export const Q_ROOMS: RoomsCollection = { type: 'FeatureCollection', features: [room(599, 5, 0)] };

function inTwoDays(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

export function inDays(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function event(id: string, roomCode: string, coord: [number, number]): MapEvent {
  return {
    id,
    title: id,
    url: '',
    date: inTwoDays(),
    endDate: null,
    time: '18:00',
    location: roomCode,
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord,
    roomCode,
    venueKind: 'campus',
    category: 'party',
  };
}
