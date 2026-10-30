import type { RoomFeature, RoomsCollection } from '../../types/campusMap';

/**
 * The library study rooms a student can book, and the two map fixes they need.
 *
 * Building A, floor −1 (`floorId` 57574). Four rooms are real polygons typed
 * `library` already. The two "Studovna IC" rooms are ONE outline in the floor
 * plan (BA01P1012, typed `office`, nickname A011): the librarians put a divider
 * in one space and Bookings sells it as two rooms, so the map has to draw two
 * (Dominik, 2026-10-30: the cut is half and half, at 90° to the long side).
 *
 * The Seminar Room (57631, 22 seats, 2 days' notice) is deliberately not here:
 * reIS does not offer it. It stays an ordinary room on the map.
 *
 * `serviceId` / `staffMemberId` are Microsoft Bookings ids, one pair per room
 * (checked against the live `services` response, 2026-10-30). They are not
 * secrets: the booking page itself serves them. Never assume a shared staff id.
 *
 * Like `mergedRooms.ts`, the split is applied on the way OUT of the API
 * (`api/campusMap.ts`), because the geometry is CDN data cached for 30 days:
 * filtering what is returned is what reaches a device that already holds A.
 */
export const LIBRARY_BUILDING_ID = 54678;
export const LIBRARY_FLOOR_ID = 57574;

/** BA01P1012 keeps its feature id and estate code and becomes the left room. */
export const IC_LEFT_ID = 57640;
/** The right room has no estate code of its own, so it gets a made-up id. */
export const IC_RIGHT_ID = 576401;

export type LibraryRoomKind = 'individual' | 'team';

export interface LibraryRoom {
  /** The map polygon (`RoomProperties.id`). */
  featureId: number;
  kind: LibraryRoomKind;
  nameCs: string;
  nameEn: string;
  seats: number;
  serviceId: string;
  staffMemberId: string;
}

export const LIBRARY_ROOMS: readonly LibraryRoom[] = [
  {
    featureId: 57621,
    kind: 'individual',
    nameCs: 'Individuální studovna 1',
    nameEn: 'Individual Study Room 1',
    seats: 1,
    serviceId: '05921bc4-327d-4cc2-b499-3b3ee4603e32',
    staffMemberId: '38efbb39-7a31-4526-bb7e-c34504f1a539',
  },
  {
    featureId: 57625,
    kind: 'individual',
    nameCs: 'Individuální studovna 2',
    nameEn: 'Individual Study Room 2',
    seats: 1,
    serviceId: 'e2b362f0-0294-45ff-97e0-1e80ef1e9f51',
    staffMemberId: 'cb31b250-257c-45f5-a79e-957300aea3a6',
  },
  {
    featureId: 57632,
    kind: 'team',
    nameCs: 'Týmová studovna 1',
    nameEn: 'Team Study Room 1',
    seats: 10,
    serviceId: '5c7477a7-4afd-4c5b-bc9f-c157c14b2972',
    staffMemberId: 'e9c87efa-0ea7-4d3e-9f9a-9e51c5775474',
  },
  {
    featureId: 57627,
    kind: 'team',
    nameCs: 'Týmová studovna 2',
    nameEn: 'Team Study Room 2',
    seats: 6,
    serviceId: 'ff081e72-01eb-4778-a6dc-d5139596cb93',
    staffMemberId: 'ee81403d-0312-49e8-a9cd-bca3be101c32',
  },
  {
    featureId: IC_LEFT_ID,
    kind: 'team',
    nameCs: 'Studovna IC levá',
    nameEn: 'Study Room IC left',
    seats: 6,
    serviceId: '7d0f31df-8b21-42d0-994c-f42d1de78093',
    staffMemberId: '2e10ced2-1057-46c5-a2df-ef90fc1ecdcc',
  },
  {
    featureId: IC_RIGHT_ID,
    kind: 'team',
    nameCs: 'Studovna IC pravá',
    nameEn: 'Study Room IC right',
    seats: 6,
    serviceId: 'c83c7c2c-c1e5-404c-8927-7254015b6930',
    staffMemberId: '548315e4-e230-44ab-b23b-19a643c2d03c',
  },
];

// The outline of BA01P1012 cut across its long side (119.5° on the map) through
// the midpoint of that side: two halves of 13.6 and 13.5 m². Computed once
// offline (a minimum-area rectangle, then a half-plane clip, 6 dp) like the rings
// in `mergedRooms.ts`: the app has no polygon clipping and should not grow one.
// Upper (north-west) half is the left room, lower (south-east) the right.
const RING_IC_LEFT: number[][] = [
  [16.615839, 49.210252],
  [16.615817, 49.210277],
  [16.615866, 49.210296],
  [16.615868, 49.210294],
  [16.615876, 49.210285],
  [16.615881, 49.210279],
  [16.615888, 49.21027],
  [16.615839, 49.210252],
];
const RING_IC_RIGHT: number[][] = [
  [16.615911, 49.210244],
  [16.615902, 49.210241],
  [16.615878, 49.210232],
  [16.615861, 49.210226],
  [16.615854, 49.210234],
  [16.615848, 49.210241],
  [16.615839, 49.210252],
  [16.615888, 49.21027],
  [16.615911, 49.210244],
];

const IC_ESTATE_NAME = 'BA01P1012';

function icHalf(template: RoomFeature, id: number, name: string, ring: number[][], nick: string) {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {
      ...template.properties,
      id,
      name,
      passportNumber: name,
      nickname: nick,
      type: 'library',
      category: 'teaching',
      label: 'Library',
      seats: 6,
    },
  } satisfies RoomFeature;
}

/**
 * Replaces the one BA01P1012 outline with the two study rooms it holds.
 *
 * A collection without it (another floor or building) or with it already split
 * comes back as the same object.
 */
export function splitIcRoom(rooms: RoomsCollection): RoomsCollection {
  const at = rooms.features.findIndex(
    (f) => f.properties.name === IC_ESTATE_NAME && f.properties.id === IC_LEFT_ID
  );
  if (at === -1 || rooms.features[at]!.properties.nickname === 'Studovna IC levá') return rooms;
  const whole = rooms.features[at]!;
  const left = icHalf(whole, IC_LEFT_ID, IC_ESTATE_NAME, RING_IC_LEFT, 'Studovna IC levá');
  const right = icHalf(
    whole,
    IC_RIGHT_ID,
    `${IC_ESTATE_NAME}B`,
    RING_IC_RIGHT,
    'Studovna IC pravá'
  );
  return {
    ...rooms,
    features: rooms.features.flatMap((f, i) => (i === at ? [left, right] : [f])),
  };
}
