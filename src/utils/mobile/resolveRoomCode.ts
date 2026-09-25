import roomsIndex from '../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../types/campusMap';
import { lookupRoomEntry } from '../rooms/lookupRoom';
import { isLabelForCode } from '../../data/map/isRoomLabels';

const INDEX = roomsIndex as RoomIndexEntry[];

export interface ResolvedRoom {
  /** What to hand `focusRoomByCode`. */
  code: string;
  /** What to show the student. */
  label: string;
}

/**
 * The first of several candidate room strings that the campus map can actually
 * find, with the label a student would recognise.
 *
 * Rooms carry up to three names and IS hands out different ones in different
 * places: a profile's office cell gives the estate code AND the friendly name
 * ("BA39N2056 (Q2.56)"), while a schedule gives the room as printed on the
 * timetable, sometimes with a campus in brackets ("Q01 (Poříčí)"). Which string
 * arrives used to decide whether a lookup succeeded; `lookupRoomEntry` accepts
 * all three fields, so it no longer does.
 *
 * Resolving BEFORE rendering is the point: `focusRoomByCode` only writes an
 * unknown room to the local console (error reporting was removed, so nobody
 * ever hears about it), so an unresolvable code becomes a button that looks
 * fine and does nothing. Callers offer the button only if this returns.
 */
export function resolveRoomCode(candidates: (string | null | undefined)[]): ResolvedRoom | null {
  for (const raw of candidates) {
    const entry = lookupRoomEntry(raw, INDEX);
    if (entry) {
      // The friendliest name the room has: what IS prints for it ("B05 –
      // Strojový sál"), then a nickname ("A01"), then the printed name
      // ("Q2.56"), then the estate code.
      return {
        code: entry.code,
        label: isLabelForCode(entry.code) || entry.nickname || entry.name || entry.code,
      };
    }
  }
  return null;
}
