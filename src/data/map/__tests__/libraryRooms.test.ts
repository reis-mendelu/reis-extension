import { describe, it, expect } from 'vitest';
import roomsIndex from '@/data/map/rooms-index.json';
import {
  LIBRARY_ROOMS,
  LIBRARY_PLACE_IDS,
  libraryRoomsByPlaceId,
  indexAvailabilityByRoom,
} from '@/data/map/libraryRooms';
import type { RoomAvailability } from '@/types/library';

const INDEX = roomsIndex as Array<{ placeId: number; buildingId: number; floorId: number }>;

describe('libraryRooms', () => {
  it('has 7 rooms, all in building 54678 / floor 57574', () => {
    expect(LIBRARY_ROOMS).toHaveLength(7);
    for (const r of LIBRARY_ROOMS) {
      expect(r.buildingId).toBe(54678);
      expect(r.floorId).toBe(57574);
    }
  });

  it('every placeId exists in the bundled room index', () => {
    for (const r of LIBRARY_ROOMS) {
      expect(INDEX.some((e) => e.placeId === r.placeId)).toBe(true);
    }
  });

  it('has unique staff GUIDs', () => {
    const guids = LIBRARY_ROOMS.map((r) => r.staffGuid);
    expect(new Set(guids).size).toBe(7);
  });

  it('has a unique, well-formed Bookings deep-link per room', () => {
    const prefix =
      'https://outlook.office.com/book/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/s/';
    const urls = LIBRARY_ROOMS.map((r) => r.bookingUrl);
    for (const url of urls) {
      expect(url.startsWith(prefix)).toBe(true);
      expect(url.length).toBeGreaterThan(prefix.length);
    }
    expect(new Set(urls).size).toBe(7);
  });

  it('groups the two IC rooms under the shared placeId 57640', () => {
    expect(libraryRoomsByPlaceId(57640)).toHaveLength(2);
    expect(LIBRARY_PLACE_IDS.has(57640)).toBe(true);
  });
});

describe('indexAvailabilityByRoom', () => {
  // The Bookings availability API returns every study room under ONE shared
  // staff GUID (a single scheduling mailbox), distinguished only by serviceId.
  // The app identifies rooms by their own per-room staffGuid, so indexing must
  // fan the shared-guid rows back out to each room's staffGuid via serviceId.
  const SHARED = '8a0cb634-8abc-4ee1-ba84-f9ba54cd6d7d';
  const apiRooms: RoomAvailability[] = LIBRARY_ROOMS.map((r) => ({
    staffGuid: SHARED,
    serviceId: r.serviceId,
    webUrl: `https://example/${r.serviceId}`,
    leadMinutes: r.leadMinutes,
    blocks: [{ status: 'AVAILABLE', start: '2026-07-20T08:00:00', end: '2026-07-20T16:00:00' }],
  }));

  it("keys availability by each room's own staffGuid, not the shared API guid", () => {
    const map = indexAvailabilityByRoom(apiRooms);
    expect(Object.keys(map)).toHaveLength(7);
    for (const room of LIBRARY_ROOMS) {
      expect(map[room.staffGuid]?.serviceId).toBe(room.serviceId);
      // the stored object's own guid is rewritten to match its key, not the shared API guid
      expect(map[room.staffGuid]?.staffGuid).toBe(room.staffGuid);
    }
    // The shared API guid must NOT survive as a key — that was the bug: all 7
    // rooms collapsed to a single entry and every per-room lookup missed.
    expect(map[SHARED]).toBeUndefined();
  });

  it('drops availability rows whose serviceId is not a known room', () => {
    const map = indexAvailabilityByRoom([
      { staffGuid: SHARED, serviceId: 'unknown-service', webUrl: '', leadMinutes: 60, blocks: [] },
    ]);
    expect(Object.keys(map)).toHaveLength(0);
  });
});
