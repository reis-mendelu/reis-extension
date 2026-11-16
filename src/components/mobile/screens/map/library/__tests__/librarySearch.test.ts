import { describe, it, expect } from 'vitest';
import { isLibraryQuery, libraryRoomOf } from '../librarySearch';
import { IC_RIGHT_ID } from '../../../../../../data/map/libraryRooms';
import type { MapSelection } from '../../../../../../types/campusMap';

describe('isLibraryQuery', () => {
  it('finds the library for the words students type, in both languages', () => {
    for (const q of [
      'knihovna',
      'Knihovna',
      'knih',
      'studovna',
      'Studovny',
      'library',
      'Study room',
      'stud',
    ])
      expect(isLibraryQuery(q), q).toBe(true);
  });
  it('stays out of ordinary room searches', () => {
    for (const q of ['Q01', 'menza', 'kn', 'A11', 'bufet'])
      expect(isLibraryQuery(q), q).toBe(false);
  });
});

describe('libraryRoomOf', () => {
  it('recognises a search result that is one of the six rooms', () => {
    const ref = { kind: 'roomRef', entry: { placeId: IC_RIGHT_ID } } as unknown as MapSelection;
    expect(libraryRoomOf(ref)).toBe(IC_RIGHT_ID);
    const other = { kind: 'roomRef', entry: { placeId: 1 } } as unknown as MapSelection;
    expect(libraryRoomOf(other)).toBeNull();
  });
});
