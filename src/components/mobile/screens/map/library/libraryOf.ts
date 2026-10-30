import { LIBRARY_ROOMS } from '../../../../../data/map/libraryRooms';
import type { MapSelection } from '../../../../../types/campusMap';

/**
 * Which part of the library the map's panel should show, if any: the room list
 * (`featureId: null`) or one room. A bookable room tapped on the floor plan is
 * an ordinary room selection, and it opens the same card as the list's row.
 */
export function libraryOf(selection: MapSelection | null): { featureId: number | null } | null {
  if (selection?.kind === 'library') return { featureId: selection.featureId ?? null };
  if (selection?.kind === 'room' && LIBRARY_ROOMS.some((r) => r.featureId === selection.room.id)) {
    return { featureId: selection.room.id };
  }
  return null;
}
