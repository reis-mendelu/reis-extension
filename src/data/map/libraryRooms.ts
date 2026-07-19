import type { LibraryRoom, RoomAvailability } from '@/types/library';

const BOOKING_BASE =
  'https://outlook.office.com/book/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/s';

// The Bookings landing page (no per-service suffix) — lists every study room so
// the student can pick and book any of them. The single CTA in the overview.
export const LIBRARY_BOOKING_HOME =
  'https://outlook.office.com/book/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/';

export const LIBRARY_ROOMS: LibraryRoom[] = [
  {
    staffGuid: 'e9c87efa-0ea7-4d3e-9f9a-9e51c5775474',
    serviceId: '5c7477a7-4afd-4c5b-bc9f-c157c14b2972',
    service: 'Team Study Room 1',
    nameCs: 'Týmová studovna 1',
    library: 'A',
    buildingId: 54678,
    floorId: 57574,
    placeId: 57632,
    capacity: 10,
    leadMinutes: 60,
    bookingUrl: `${BOOKING_BASE}/p3d0XP1KW0y8n8FXwUspcg2`,
  },
  {
    staffGuid: 'ee81403d-0312-49e8-a9cd-bca3be101c32',
    serviceId: 'ff081e72-01eb-4778-a6dc-d5139596cb93',
    service: 'Team Study Room 2',
    nameCs: 'Týmová studovna 2',
    library: 'A',
    buildingId: 54678,
    floorId: 57574,
    placeId: 57627,
    capacity: 6,
    leadMinutes: 60,
    bookingUrl: `${BOOKING_BASE}/ch4I_-sBeEem3NUTlZbLkw2`,
  },
  {
    staffGuid: '38efbb39-7a31-4526-bb7e-c34504f1a539',
    serviceId: '05921bc4-327d-4cc2-b499-3b3ee4603e32',
    service: 'Individual Study Room 1',
    nameCs: 'Individuální studovna 1',
    library: 'A',
    buildingId: 54678,
    floorId: 57574,
    placeId: 57621,
    capacity: 2,
    leadMinutes: 60,
    bookingUrl: `${BOOKING_BASE}/xBuSBX0ywky0mTs-5GA-Mg2`,
  },
  {
    staffGuid: 'cb31b250-257c-45f5-a79e-957300aea3a6',
    serviceId: 'e2b362f0-0294-45ff-97e0-1e80ef1e9f51',
    service: 'Individual Study Room 2',
    nameCs: 'Individuální studovna 2',
    library: 'A',
    buildingId: 54678,
    floorId: 57574,
    placeId: 57625,
    capacity: 2,
    leadMinutes: 60,
    bookingUrl: `${BOOKING_BASE}/8GKz4pQC_0WX4B6A7x6fUQ2`,
  },
  {
    staffGuid: '2e10ced2-1057-46c5-a2df-ef90fc1ecdcc',
    serviceId: '7d0f31df-8b21-42d0-994c-f42d1de78093',
    service: 'Study Room IC 1',
    nameCs: 'Studovna IC 1',
    library: 'IC',
    buildingId: 54678,
    floorId: 57574,
    placeId: 57640,
    capacity: 6,
    leadMinutes: 60,
    bookingUrl: `${BOOKING_BASE}/3zEPfSGL0EKZTPQtHeeAkw2`,
  },
  {
    staffGuid: '548315e4-e230-44ab-b23b-19a643c2d03c',
    serviceId: 'c83c7c2c-c1e5-404c-8927-7254015b6930',
    service: 'Study Room IC 2',
    nameCs: 'Studovna IC 2',
    library: 'IC',
    buildingId: 54678,
    floorId: 57574,
    placeId: 57640,
    capacity: 6,
    leadMinutes: 60,
    bookingUrl: `${BOOKING_BASE}/LHw8yOXBTECJJ3JUAVtpMA2`,
  },
  {
    staffGuid: 'ee8fec8f-ccf4-4e1c-871d-e0cd725ba90a',
    serviceId: '31148510-2832-478b-9655-b1a5fd68eb87',
    service: 'Seminar Room',
    nameCs: 'Seminární místnost',
    library: 'A',
    buildingId: 54678,
    floorId: 57574,
    placeId: 57631,
    capacity: [10, 18],
    leadMinutes: 2880,
    bookingUrl: `${BOOKING_BASE}/EIUUMTIoi0eWVbGl_Wjrhw2`,
  },
];

export const LIBRARY_PLACE_IDS: Set<number> = new Set(LIBRARY_ROOMS.map((r) => r.placeId));

export function libraryRoomsByPlaceId(placeId: number): LibraryRoom[] {
  return LIBRARY_ROOMS.filter((r) => r.placeId === placeId);
}

// Reconcile the Bookings availability API's identity with the app's. The API
// returns every study room under ONE shared staff GUID (a single scheduling
// mailbox), telling rooms apart only by `serviceId`. The rest of the app keys a
// room by its own per-room `staffGuid` (the id the booking-create path sends and
// the edge's allow-list validates). So index availability by that per-room
// staffGuid, matching each API row to a room on the unique serviceId. Rows whose
// serviceId isn't a known room are dropped. Keying the API rows directly by their
// `staffGuid` would collapse all rooms into one entry — the shared guid — and
// leave every per-room lookup missing.
export function indexAvailabilityByRoom(
  rooms: RoomAvailability[]
): Record<string, RoomAvailability> {
  const byServiceId = new Map(rooms.map((r) => [r.serviceId, r]));
  const out: Record<string, RoomAvailability> = {};
  for (const room of LIBRARY_ROOMS) {
    const a = byServiceId.get(room.serviceId);
    // Overwrite the row's `staffGuid` (the shared API mailbox guid) with the
    // room's own guid so the object is self-consistent with its map key.
    if (a) out[room.staffGuid] = { ...a, staffGuid: room.staffGuid };
  }
  return out;
}
