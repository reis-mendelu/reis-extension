import { describe, it, expect } from 'vitest';
import { searchVenues, venueRoomTitles } from '../venueSearch';
import { searchPlaces } from '../mapHelpers';
import { venueRowToPin } from '../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../test/fixtures/sklubVenueRow';
import type { RoomIndexEntry, SocietyPin } from '../../../types/campusMap';

const sklub = venueRowToPin(SKLUB_VENUE_ROW)!;
const notice: SocietyPin = {
  id: 'p1',
  societyId: 'vazbic',
  title: 'Vazbič',
  description: null,
  url: null,
  coord: [16.61, 49.21],
};

describe('searchVenues', () => {
  it.each(['sklub', 's-klub', 'S klub', 'pixie', 'kavárna', 'kavarna', 'KAVÁRNA', 'café', 'cafe'])(
    'finds S-klub Pixie for "%s"',
    (q) => {
      expect(searchVenues(q, [sklub])).toEqual([sklub]);
    }
  );

  it.each(['q01', 'vazbič', '', '  ', '-'])('finds nothing for "%s"', (q) => {
    expect(searchVenues(q, [sklub])).toEqual([]);
  });

  it('lists only venues, never a plain society pin', () => {
    expect(searchVenues('vazbič', [notice])).toEqual([]);
  });
});

const room = (name: string, code: string): RoomIndexEntry => ({
  code,
  name,
  nickname: null,
  buildingId: 0,
  floorId: 0,
  floorLevel: 0,
  placeId: 1,
});

describe('searchPlaces with venues', () => {
  it('lists the venue as a society-pin result, the selection its pin opens', () => {
    const r = searchPlaces('pixie', [], [], [], [], [sklub]);
    expect(r).toEqual([{ kind: 'societyPin', pin: sklub }]);
  });

  it('lists the venue before a room of the same name', () => {
    const namesake = room('S-klub Pixie', 'BA39P1099');
    const r = searchPlaces('s-klub pixie', [namesake], [], [], [], [sklub]);
    expect(r).toEqual([
      { kind: 'societyPin', pin: sklub },
      { kind: 'roomRef', entry: namesake },
    ]);
  });

  it('leaves the other results alone when no venue matches', () => {
    const q01 = room('Q01', 'BA39P1001');
    const without = searchPlaces('q01', [q01], [], [], []);
    expect(without).toEqual([{ kind: 'roomRef', entry: q01 }]);
    expect(searchPlaces('q01', [q01], [], [], [], [sklub])).toEqual(without);
  });
});

describe('venueRoomTitles', () => {
  it('names a venue room by the venue, keyed by its IS room code', () => {
    expect(venueRoomTitles([sklub]).get('BZ00N1015')).toBe('S-klub Pixie');
  });

  it('skips pins with no room: a venue outside a room and a plain society pin', () => {
    const outside: SocietyPin = { ...sklub, venue: { ...sklub.venue!, roomCode: null } };
    expect(venueRoomTitles([outside, notice]).size).toBe(0);
  });
});
