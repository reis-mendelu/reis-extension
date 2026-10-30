import type { MapSelection, RoomTint } from '../../types/campusMap';

/**
 * Whether the other rooms of the floor go quiet: while a screen's own rooms are
 * the question (the library's list, or one of its rooms picked on the plan).
 * Back out to nothing selected and the floor reads as an ordinary floor again,
 * with the tinted rooms still tinted.
 */
export function dimsOtherRooms(sel: MapSelection | null, tints: Record<number, RoomTint>): boolean {
  if (Object.keys(tints).length === 0) return false;
  if (sel?.kind === 'library') return true;
  return sel?.kind === 'room' && sel.room.id in tints;
}
