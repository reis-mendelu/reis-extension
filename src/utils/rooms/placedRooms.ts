import type { RoomIndexEntry } from '../../types/campusMap';
import { lookupRoomEntry } from './lookupRoom';
import { makeRoomPlaceLookup, type RoomPlaceEntry } from './lookupRoomPlace';

/** A room map search offers although the map draws no floor plan for it. */
export interface PlacedRoom {
  /** IS's label — what `focusRoomByCode` is handed, exactly as a timetable prints it. */
  label: string;
  /** What the result row reads ("Učebna Útěchov" for `ucebna_utechov`). */
  display: string;
}

/**
 * The IS rooms map search can offer on top of the rooms the map draws: D05 has
 * no floor plan, but a lesson there already flies to building D, and typing
 * "D05" into the search found nothing at all.
 *
 * Only labels `focusRoomByCode` actually resolves through their place: one the
 * room index knows is already a search hit, and one IS uses on two campuses
 * resolves nowhere without the bracketed campus a timetable would print.
 * `takenNames` drops a place search lists already under that name (the design
 * lab is a landmark).
 */
export function placedRooms(
  entries: readonly RoomPlaceEntry[],
  index: RoomIndexEntry[],
  takenNames: readonly string[]
): PlacedRoom[] {
  const lookup = makeRoomPlaceLookup(entries);
  const taken = new Set(takenNames.map((n) => n.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: PlacedRoom[] = [];
  for (const { label } of entries) {
    if (seen.has(label)) continue;
    seen.add(label);
    const place = lookup(label);
    if (!place || lookupRoomEntry(label, index)) continue;
    if (taken.has(place.label.trim().toLowerCase())) continue;
    out.push({ label, display: place.label });
  }
  return out;
}
