import { describe, it, expect } from 'vitest';
import roomsIndexJson from '../../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../../types/campusMap';
import { lookupRoomEntry } from '../lookupRoom';
import { lookupRoomPlace, lookupRoomTarget } from '../lookupRoomPlace';
import { resolveRoomCode } from '../../mobile/resolveRoomCode';

const INDEX = roomsIndexJson as RoomIndexEntry[];

// A timetable brackets the campus only when it is NOT Černá Pole ("Aula (ČP II.)",
// "ZFAC1 (Led)"), and every room the map draws is on Černá Pole. IS has two
// rooms called "Aula": building A's (BA01N3054, which the map also nicknames
// "Aula") and FRRMS's in building Z at Černá Pole II. Trying the part outside
// the bracket sent 46 FRRMS lessons a semester to building A.
describe('lookupRoomEntry, with a campus in the brackets', () => {
  it('does not put FRRMS’s Aula in building A', () => {
    expect(lookupRoomEntry('Aula (ČP II.)', INDEX)).toBeNull();
  });

  it.each(['Aula', 'Aula (ČP)'])('still finds building A’s Aula for %s', (raw) => {
    expect(lookupRoomEntry(raw, INDEX)?.code).toBe('BA01N3054');
  });

  it('refuses any mapped room named with an off-map campus', () => {
    expect(lookupRoomEntry('B05 – Strojový sál (Led)', INDEX)).toBeNull();
  });

  // Not every bracket is a campus: a staff profile puts the friendly name
  // beside the estate code.
  it('still reads a bracket that is not a campus', () => {
    expect(lookupRoomEntry('BA39N2056 (Q2.56)', INDEX)?.code).toBe('BA39N2056');
  });
});

describe('lookupRoomTarget for FRRMS’s Aula', () => {
  it('shows the FRRMS building, not a room in building A', () => {
    expect(lookupRoomTarget('Aula (ČP II.)', INDEX)).toEqual({
      kind: 'place',
      place: { kind: 'landmark', id: 1587, label: 'Aula' },
    });
  });

  // Without a bracket the room is on Černá Pole, and that Aula is a map room.
  it('does not place a bare "Aula" at Černá Pole II', () => {
    expect(lookupRoomPlace('Aula')).toBeNull();
    expect(lookupRoomTarget('Aula', INDEX)).toMatchObject({
      kind: 'room',
      entry: { code: 'BA01N3054' },
    });
  });
});

// resolveRoomCode walks candidates that can be DIFFERENT rooms (a profile's
// office, then a room the person teaches in). An off-map room is no reason to
// skip the next one; lessonTarget, whose strings are one room, stops itself.
describe('resolveRoomCode', () => {
  it('moves past a room on an off-map campus to the next candidate', () => {
    expect(resolveRoomCode(['Z25 (ČP II.)', 'Q31'])?.label).toBe('Q31');
  });

  it('still falls through an unknown room to the next string', () => {
    expect(resolveRoomCode(['NOT-A-ROOM', 'Aula'])?.code).toBe('BA01N3054');
  });
});
