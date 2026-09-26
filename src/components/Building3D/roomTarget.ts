import roomsIndexJson from '../../data/map/rooms-index.json';
import { lookupRoomEntry } from '../../utils/rooms/lookupRoom';
import { roomLabel } from '../CampusMap/mapHelpers';
import type { MapSelection, RoomIndexEntry } from '../../types/campusMap';

const INDEX = roomsIndexJson as RoomIndexEntry[];

/** What the building card needs to know about the room it is showing. */
export interface RoomTarget {
  buildingId: number;
  floorLevel: number | null;
  roomId: number | null;
  label: string;
}

/** From a room string as a timetable prints it ("Q01", "Q01 (Poříčí)"). */
export function targetFromRoomName(roomName: string): RoomTarget | null {
  const entry = lookupRoomEntry(roomName, INDEX);
  if (!entry) return null;
  return {
    buildingId: entry.buildingId,
    floorLevel: entry.floorLevel,
    roomId: entry.placeId,
    label: roomName,
  };
}

/** From a map selection, when it is a room. */
export function targetFromSelection(sel: MapSelection | null): RoomTarget | null {
  if (sel?.kind === 'room') {
    const r = sel.room;
    return {
      buildingId: r.buildingId,
      floorLevel: r.floorLevel,
      roomId: r.id,
      label: roomLabel(r.name, r.passportNumber, r.nickname),
    };
  }
  if (sel?.kind === 'roomRef') {
    const e = sel.entry;
    return {
      buildingId: e.buildingId,
      floorLevel: e.floorLevel,
      roomId: e.placeId,
      label: roomLabel(e.name, e.code, e.nickname),
    };
  }
  return null;
}
