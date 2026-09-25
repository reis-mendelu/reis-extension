import { describe, it, expect } from 'vitest';
import roomsIndexJson from '../../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../../types/campusMap';
import { lookupRoomPlace, lookupRoomTarget, makeRoomPlaceLookup } from '../lookupRoomPlace';

const INDEX = roomsIndexJson as RoomIndexEntry[];

describe('lookupRoomPlace', () => {
  // Real timetable strings, as IS prints them, against the bundled
  // isRoomPlaces.json (reis-data placeIsRooms.mjs).
  it.each([
    ['T18', 'poi', 1572], // building T pin, Černá Pole
    ['D03', 'poi', 1592], // IS calls the building "D_old"
    ['ZFAC1 (Led)', 'remote', -102], // Lednice campus
    ['Z11 (ČP II.)', 'landmark', 1587], // FRRMS, Černá Pole II
    ['B1 CSA (TAK)', 'landmark', 1623], // CSA Hala B
    ['Design lab MENDELU', 'landmark', -201],
  ])('places %s on the map', (raw, kind, id) => {
    expect(lookupRoomPlace(raw)).toMatchObject({ kind, id });
  });

  it('carries the room name without the campus', () => {
    expect(lookupRoomPlace('ZFAC1 (Led)')?.label).toBe('ZFAC1');
  });

  it.each(['Mimo areál CSA (TAK)', 'B Virtuální 6', 'Virtuální učebna'])(
    'gives %s no place',
    (raw) => {
      expect(lookupRoomPlace(raw)).toBeNull();
    }
  );

  // IS's "Brno - Soběšice" campus is two unrelated buildings: the wood-science
  // centre in Areál Útěchov, and PL001, which IS's own syllabus puts at the
  // Panská lícha riding hall.
  it.each([
    ['ucebna_utechov (Sob)', -106],
    ['PL001 (Sob)', -105],
  ])('places %s on its site', (raw, id) => {
    expect(lookupRoomPlace(raw)).toMatchObject({ kind: 'remote', id });
  });

  // IS files "Lesní škola Jezírko" under ŠLP's Hubertka cabin (Křtiny), but the
  // name is the Lipka-run forest school by Soběšice — no place rather than a guess.
  it('leaves the ŠLP Jezírko forest school unplaced', () => {
    expect(lookupRoomPlace('Lesní škola Jezírko (ŠLP)')).toBeNull();
  });

  it('refuses a room on the wrong campus', () => {
    expect(lookupRoomPlace('T18 (Led)')).toBeNull();
  });

  it('refuses to pick when a name without a campus is on two campuses', () => {
    const lookup = makeRoomPlaceLookup([
      { label: 'U1', campus: 'ČP', kind: 'poi', id: 1 },
      { label: 'U1', campus: 'Led', kind: 'remote', id: -102 },
    ]);
    expect(lookup('U1')).toBeNull();
    expect(lookup('U1 (Led)')).toMatchObject({ kind: 'remote', id: -102 });
  });

  it('returns null for nothing at all', () => {
    expect(lookupRoomPlace('')).toBeNull();
    expect(lookupRoomPlace(null)).toBeNull();
    expect(lookupRoomPlace('NOT-A-ROOM')).toBeNull();
  });
});

describe('lookupRoomTarget', () => {
  it('prefers the room itself when the map draws it', () => {
    expect(lookupRoomTarget('B05 – Strojový sál', INDEX)).toMatchObject({
      kind: 'room',
      entry: { code: 'BA04N1065' },
    });
  });

  it('falls back to the building when the map has no floor plan', () => {
    expect(lookupRoomTarget('T18', INDEX)).toMatchObject({ kind: 'place', place: { id: 1572 } });
  });

  it('is null when there is neither', () => {
    expect(lookupRoomTarget('Lesní škola Jezírko (ŠLP)', INDEX)).toBeNull();
  });
});
