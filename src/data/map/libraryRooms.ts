import type { LibraryRoom } from '@/types/library';

export const LIBRARY_ROOMS: LibraryRoom[] = [
  { staffGuid: 'e9c87efa-0ea7-4d3e-9f9a-9e51c5775474', serviceId: '5c7477a7-4afd-4c5b-bc9f-c157c14b2972', service: 'Team Study Room 1', nameCs: 'Týmová studovna 1', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57632, capacity: 10, leadMinutes: 60 },
  { staffGuid: 'ee81403d-0312-49e8-a9cd-bca3be101c32', serviceId: 'ff081e72-01eb-4778-a6dc-d5139596cb93', service: 'Team Study Room 2', nameCs: 'Týmová studovna 2', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57627, capacity: 6, leadMinutes: 60 },
  { staffGuid: '38efbb39-7a31-4526-bb7e-c34504f1a539', serviceId: '05921bc4-327d-4cc2-b499-3b3ee4603e32', service: 'Individual Study Room 1', nameCs: 'Individuální studovna 1', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57621, capacity: 2, leadMinutes: 60 },
  { staffGuid: 'cb31b250-257c-45f5-a79e-957300aea3a6', serviceId: 'e2b362f0-0294-45ff-97e0-1e80ef1e9f51', service: 'Individual Study Room 2', nameCs: 'Individuální studovna 2', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57625, capacity: 2, leadMinutes: 60 },
  { staffGuid: '2e10ced2-1057-46c5-a2df-ef90fc1ecdcc', serviceId: '7d0f31df-8b21-42d0-994c-f42d1de78093', service: 'Study Room IC 1', nameCs: 'Studovna IC 1', library: 'IC', buildingId: 54678, floorId: 57574, placeId: 57640, capacity: 6, leadMinutes: 60 },
  { staffGuid: '548315e4-e230-44ab-b23b-19a643c2d03c', serviceId: 'c83c7c2c-c1e5-404c-8927-7254015b6930', service: 'Study Room IC 2', nameCs: 'Studovna IC 2', library: 'IC', buildingId: 54678, floorId: 57574, placeId: 57640, capacity: 6, leadMinutes: 60 },
  { staffGuid: 'ee8fec8f-ccf4-4e1c-871d-e0cd725ba90a', serviceId: '31148510-2832-478b-9655-b1a5fd68eb87', service: 'Seminar Room', nameCs: 'Seminární místnost', library: 'A', buildingId: 54678, floorId: 57574, placeId: 57631, capacity: [10, 18], leadMinutes: 2880 },
];

export const LIBRARY_PLACE_IDS: Set<number> = new Set(LIBRARY_ROOMS.map((r) => r.placeId));

export function libraryRoomsByPlaceId(placeId: number): LibraryRoom[] {
  return LIBRARY_ROOMS.filter((r) => r.placeId === placeId);
}
