import { describe, it, expect } from 'vitest';
import roomsIndex from '@/data/map/rooms-index.json';
import { LIBRARY_ROOMS, LIBRARY_PLACE_IDS, libraryRoomsByPlaceId } from '@/data/map/libraryRooms';

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
    const prefix = 'https://outlook.office.com/book/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/s/';
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
