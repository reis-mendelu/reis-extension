import { describe, it, expect } from 'vitest';
import roomsIndexJson from '../../../data/map/rooms-index.json';
import isRoomPlacesJson from '../../../data/map/isRoomPlaces.json';
import type { RoomIndexEntry } from '../../../types/campusMap';
import { lookupRoomPlace, type RoomPlaceEntry } from '../lookupRoomPlace';
import { placedRooms } from '../placedRooms';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const PLACES = isRoomPlacesJson as RoomPlaceEntry[];

describe('placedRooms', () => {
  it('offers a room that only has a building pin (D05 → building D)', () => {
    const r = placedRooms(PLACES, INDEX, []);
    expect(r).toContainEqual({ label: 'D05', display: 'D05' });
  });

  it('shows the readable name when IS labels a room by a handle', () => {
    const r = placedRooms(PLACES, INDEX, []);
    expect(r).toContainEqual({ label: 'ucebna_utechov', display: 'Učebna Útěchov' });
  });

  it('never offers a label the map draws as a room — search already has it', () => {
    const entries: RoomPlaceEntry[] = [{ label: 'Q01', campus: 'ČP', kind: 'poi', id: 1 }];
    expect(placedRooms(entries, INDEX, [])).toEqual([]);
  });

  it('drops a label on two campuses: with no campus it resolves nowhere', () => {
    const entries: RoomPlaceEntry[] = [
      { label: 'X99', campus: 'ČP', kind: 'poi', id: 1 },
      { label: 'X99', campus: 'Led', kind: 'remote', id: -1 },
    ];
    expect(placedRooms(entries, INDEX, [])).toEqual([]);
  });

  it('drops a place already listed under the same name (a landmark)', () => {
    const entries: RoomPlaceEntry[] = [
      { label: 'Design lab MENDELU', campus: 'ČP', kind: 'landmark', id: -201 },
    ];
    expect(placedRooms(entries, INDEX, ['design lab MENDELU'])).toEqual([]);
  });

  it('every offer flies somewhere: focusRoomByCode resolves each label', () => {
    for (const { label } of placedRooms(PLACES, INDEX, [])) {
      expect(lookupRoomPlace(label), label).not.toBeNull();
    }
  });
});
