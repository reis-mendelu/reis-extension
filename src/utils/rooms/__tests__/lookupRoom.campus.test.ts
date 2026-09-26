import { describe, it, expect } from 'vitest';
import roomsIndexJson from '../../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../../types/campusMap';
import { lookupRoomEntry } from '../lookupRoom';
import { lookupRoomPlace, lookupRoomTarget } from '../lookupRoomPlace';
import { resolveRoomCode } from '../../mobile/resolveRoomCode';

const INDEX = roomsIndexJson as RoomIndexEntry[];

// A timetable brackets the campus only when it is NOT Černá Pole ("Aula (ČP II.)",
// "ZFAC1 (Led)"). IS has two rooms called "Aula": building A's (BA01N3054, which
// the map also nicknames "Aula") and FRRMS's in building Z at Černá Pole II.
// Trying the part outside the bracket sent 46 FRRMS lessons a semester to
// building A. Since budova Z has a floor plan (2026-09), the bracket says which.
describe('lookupRoomEntry, with a campus in the brackets', () => {
  it('puts FRRMS’s Aula in building Z, not building A', () => {
    expect(lookupRoomEntry('Aula (ČP II.)', INDEX)?.code).toBe('BZ00N1000');
  });

  it.each([
    ['Z14 (ČP II.)', 'BZ00N2024'],
    ['Z11 (ČP II.)', 'BZ00N2031'],
    ['Z28 (ČP II.)', 'BZ00N2085'],
    ['Zasedačka FRRMS 4NP (ČP II.)', 'BZ00N4002'],
  ])('finds %s in building Z', (raw, code) => {
    expect(lookupRoomEntry(raw, INDEX)?.code).toBe(code);
  });

  // IS labels are unique across campuses except "Aula", so a bare FRRMS label
  // (search, a structured name without the campus) still finds its room.
  it.each([
    ['Z14', 'BZ00N2024'],
    ['Coworking', 'BZ00N4002'],
  ])('finds a bare %s', (raw, code) => {
    expect(lookupRoomEntry(raw, INDEX)?.code).toBe(code);
  });

  // Černá Pole II. has map rooms only through IS's labels for building Z, so a
  // bracketed ČP II. name never falls back to a Černá Pole nickname.
  it('a ČP II. label with no Z room resolves to nothing, not to a Černá Pole room', () => {
    expect(lookupRoomEntry('K01 (ČP II.)', INDEX)).toBeNull();
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
  it('shows the Aula room in building Z, not a room in building A', () => {
    expect(lookupRoomTarget('Aula (ČP II.)', INDEX)).toMatchObject({
      kind: 'room',
      entry: { code: 'BZ00N1000', buildingId: 9000001, floorLevel: 0 },
    });
  });

  it('shows Budova K (no plan) on building Z’s outline', () => {
    expect(lookupRoomTarget('K01 (ČP II.)', INDEX)).toEqual({
      kind: 'place',
      place: { kind: 'building', id: 9000001, label: 'K01' },
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
    expect(resolveRoomCode(['ZFAC1 (Led)', 'Q31'])?.label).toBe('Q31');
  });

  it('still falls through an unknown room to the next string', () => {
    expect(resolveRoomCode(['NOT-A-ROOM', 'Aula'])?.code).toBe('BA01N3054');
  });
});
