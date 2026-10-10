import { describe, it, expect } from 'vitest';
import roomsIndexJson from '../../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../../types/campusMap';
import { lookupRoomEntry } from '../lookupRoom';
import { IS_ROOM_LABELS } from '../../../data/map/isRoomLabels';

const INDEX = roomsIndexJson as RoomIndexEntry[];

// lookupRoomEntry consults IS's own label → room pairing (isRoomLabels.json)
// before anything the map says. Split from lookupRoom.test.ts to keep both
// under the 200-line convention.
describe('lookupRoomEntry, through the IS room catalogue', () => {
  // IS's public room catalogue pairs each timetable label with the estate
  // number the map carries (reis-data isRoomLabels.json). These rooms had no
  // usable handle in the map at all — 925 lessons a semester found nothing.
  it.each([
    ['B05 – Strojový sál', 'BA04N1065'], // exactly as a timetable prints it
    ['B06', 'BA04N1029'], // the map nicknames this room "B40"
    ['B44', 'BA04N5026'],
    ['A49', 'BA01N5071'],
    ['E01', 'BA05N1013'],
  ])('resolves %s through the IS catalogue', (label, code) => {
    expect(lookupRoomEntry(label, INDEX)?.code).toBe(code);
  });

  // IS lists A410–A418 as N50xx, one floor above where the map's own "A411"
  // and "A412" nicknames sit (N4084/N4082). The timetable means IS's room.
  it.each([
    ['A411', 'BA01N5072'],
    ['A412', 'BA01N5036'],
  ])('lets the IS catalogue outrank a map nickname for %s', (label, code) => {
    expect(lookupRoomEntry(label, INDEX)?.code).toBe(code);
  });

  // As a timetable prints it: bare on Černá Pole, with the campus elsewhere
  // ("Aula (ČP II.)"), since IS reuses a label across campuses.
  it('resolves every IS label, as a timetable prints it, to the room IS pairs it with', () => {
    const printed = (l: { label: string; campus?: string }) =>
      l.campus ? `${l.label} (${l.campus})` : l.label;
    const strays = IS_ROOM_LABELS.filter(
      (l) => lookupRoomEntry(printed(l), INDEX)?.code !== l.code
    );
    expect(strays).toEqual([]);
  });

  it('ignores an IS pairing whose room is not in the index it is given', () => {
    const stub: RoomIndexEntry[] = [
      {
        code: 'X9',
        name: 'B06',
        nickname: null,
        buildingId: 1,
        floorId: 1,
        floorLevel: 1,
        placeId: 1,
      },
    ];
    expect(lookupRoomEntry('B06', stub)?.code).toBe('X9');
  });

  // IS settles a tie the map cannot: its catalogue lists E17 as BA05N2018.
  // B52 names two offices, which IS does not list as classrooms at all.
  it('takes the IS catalogue’s answer for E17', () => {
    expect(lookupRoomEntry('E17', INDEX)?.code).toBe('BA05N2018');
  });

  // The hand-written PREFERRED_ROOM table and IS's catalogue were derived
  // independently; they must keep agreeing.
  it.each([
    ['B22', 'BA04N3022'],
    ['B35', 'BA04N4036'],
    ['C11', 'BA03N2045'],
  ])('agrees with the IS catalogue on %s', (label, code) => {
    expect(IS_ROOM_LABELS.find((l) => l.label === label)?.code).toBe(code);
  });
});
