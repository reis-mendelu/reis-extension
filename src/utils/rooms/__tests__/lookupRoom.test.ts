import { describe, it, expect } from 'vitest';
import roomsIndexJson from '../../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../../types/campusMap';
import { lookupRoomEntry, isNonPhysicalRoom, normalizeRoomKey } from '../lookupRoom';

const INDEX = roomsIndexJson as RoomIndexEntry[];

describe('normalizeRoomKey', () => {
  it('folds case and collapses whitespace', () => {
    expect(normalizeRoomKey('  a01 ')).toBe('a01');
    expect(normalizeRoomKey('B  Virtuální   6')).toBe('b virtuální 6');
  });

  // Measured over the whole index: padding/dot folding turns 16 ambiguous keys
  // into 77, and the new ones are different FLOORS of building Q ("Q1.05" is
  // above ground, "Q01.05" below). Sending a student one floor off is worse
  // than the dead button, so these must stay distinct.
  it('keeps zero-padded and dotted variants distinct', () => {
    expect(normalizeRoomKey('Q1.05')).not.toBe(normalizeRoomKey('Q01.05'));
    expect(normalizeRoomKey('A01')).not.toBe(normalizeRoomKey('A1'));
  });
});

describe('lookupRoomEntry', () => {
  it('resolves a PEF hall, whose friendly code lives in `name`', () => {
    expect(lookupRoomEntry('Q02', INDEX)?.code).toBe('BA39N1010');
  });

  // The regression the whole module exists for: buildings A/B/C/E/M put the raw
  // passport code in `name` and the friendly code students actually read off a
  // timetable in `nickname`. Matching only code/name made every one of them dead.
  it('resolves a hall whose friendly code lives only in `nickname`', () => {
    expect(lookupRoomEntry('A01', INDEX)?.code).toBe('BA01N1052');
    expect(lookupRoomEntry('C02', INDEX)?.code).toBe('BA03N2051');
  });

  it('resolves the raw estate code', () => {
    expect(lookupRoomEntry('BA39N2056', INDEX)?.name).toBe('Q2.56');
  });

  it('ignores case and stray whitespace', () => {
    expect(lookupRoomEntry(' a01 ', INDEX)?.code).toBe('BA01N1052');
    expect(lookupRoomEntry('ba39n2056', INDEX)?.name).toBe('Q2.56');
  });

  it('strips the campus a timetable prints after the room', () => {
    expect(lookupRoomEntry('Q01 (Poříčí)', INDEX)?.code).toBe('BA39N1009');
  });

  // A staff profile prints "BA39N2056 (Q2.56)" — both halves name the room, so
  // either half must be enough. IS is not consistent about which it shows.
  it('accepts the bracketed half when the leading half is not the handle', () => {
    expect(lookupRoomEntry('BA39N2056 (Q2.56)', INDEX)?.code).toBe('BA39N2056');
    expect(lookupRoomEntry('Nějaká budova (A01)', INDEX)?.code).toBe('BA01N1052');
  });

  it('prefers an exact match over a case-folded one', () => {
    // BA03N5041a and BA03N5041A are different rooms; folding alone would let
    // the wrong one win. An exact hit must always be taken first.
    const exact = lookupRoomEntry('BA03N5041a', INDEX);
    expect(exact?.code).toBe('BA03N5041a');
  });

  it('returns null for a room the dataset does not contain', () => {
    // Real strings off a Zahradnická fakulta timetable. Building X's index
    // entries are all raw BA25* codes — no X02/X03 exists under any handle.
    expect(lookupRoomEntry('X02', INDEX)).toBeNull();
    expect(lookupRoomEntry('X03', INDEX)).toBeNull();
    expect(lookupRoomEntry('', INDEX)).toBeNull();
  });

  // The 16 keys the DATASET makes ambiguous: two or more entries advertise the
  // same handle, so one of them is unreachable by it and no resolver can tell
  // them apart from the room string alone. Frozen deliberately — five of them
  // (B22, B35, B52, C11, E17) name rooms on two different FLOORS, so if this
  // list ever grows, someone is being sent to the wrong floor by a new
  // collision and that must surface here rather than in a student's week.
  const DATASET_AMBIGUOUS = [
    '\b', // two byte-identical M rows whose code/name is a literal backspace
    'b22',
    'b35',
    'b52',
    'ba03n5041',
    'ba03p1029',
    'ba04n3049',
    'ba04n4049',
    'ba27', // three byte-identical duplicate M rows
    'c11',
    'e17',
    'odpočinková zóna',
    'pr oddělení',
    'učebna agronomické fakulty.',
    'zahraniční oddělení',
  ];

  // Stronger than "every handle resolves to something": every handle must
  // resolve back to ITS OWN entry. The weaker form passes trivially for every
  // collision above, which is exactly the failure that hurts — a button that
  // opens the wrong room looks like it worked.
  it('resolves every handle back to its own entry, bar the dataset ambiguities', () => {
    const strays: string[] = [];
    for (const e of INDEX) {
      for (const handle of [e.code, e.name, e.nickname]) {
        if (!handle || !handle.trim()) continue;
        if (DATASET_AMBIGUOUS.includes(normalizeRoomKey(handle))) continue;
        if (lookupRoomEntry(handle, INDEX) !== e) strays.push(handle);
      }
    }
    expect(strays).toEqual([]);
  });

  // The property that makes matching `nickname` safe at all. A nickname is the
  // friendly code a timetable prints ("A01"); an estate code is what the map
  // stores. If a nickname ever equalled a DIFFERENT room's code or name, adding
  // nickname matching would start hijacking lookups that used to be exact.
  it('never lets a nickname shadow another entry’s code or name', () => {
    const byNickname = new Map<string, RoomIndexEntry[]>();
    for (const e of INDEX) {
      if (!e.nickname || !e.nickname.trim()) continue;
      const k = normalizeRoomKey(e.nickname);
      byNickname.set(k, [...(byNickname.get(k) ?? []), e]);
    }
    const shadowed: string[] = [];
    for (const e of INDEX) {
      for (const handle of [e.code, e.name]) {
        if (!handle || !handle.trim()) continue;
        const owners = byNickname.get(normalizeRoomKey(handle)) ?? [];
        if (owners.some((o) => o !== e)) shadowed.push(handle);
      }
    }
    expect(shadowed).toEqual([]);
  });
});

describe('isNonPhysicalRoom', () => {
  it('recognises the virtual rooms IS schedules a lesson into', () => {
    expect(isNonPhysicalRoom('B Virtuální 6')).toBe(true);
    expect(isNonPhysicalRoom('Virtuální místnost')).toBe(true);
    expect(isNonPhysicalRoom('Online')).toBe(true);
  });

  it('does not mistake a real room for a virtual one', () => {
    expect(isNonPhysicalRoom('A01')).toBe(false);
    expect(isNonPhysicalRoom('Q2.56')).toBe(false);
  });
});
