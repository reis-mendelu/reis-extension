import { LIBRARY_ROOMS, type LibraryPart } from '../../../../../data/map/libraryRooms';
import type { MapSelection } from '../../../../../types/campusMap';

/**
 * Which part of the library the map's panel should show, if any: the room list
 * (`featureId: null`) or one room. A bookable room tapped on the floor plan is
 * an ordinary room selection, and it opens the same card as the list's row.
 */
export interface LibraryView {
  /** The room shown, or null for the list. */
  featureId: number | null;
  /** The part of the library the list (and the camera) is on. */
  group: LibraryPart;
}

export function libraryOf(selection: MapSelection | null): LibraryView | null {
  const partOf = (id: number | undefined): LibraryPart | undefined =>
    LIBRARY_ROOMS.find((r) => r.featureId === id)?.part;
  if (selection?.kind === 'library') {
    const group = partOf(selection.featureId) ?? (selection.group === 'ic' ? 'ic' : 'main');
    return { featureId: selection.featureId ?? null, group };
  }
  if (selection?.kind === 'room' && partOf(selection.room.id)) {
    return { featureId: selection.room.id, group: partOf(selection.room.id)! };
  }
  return null;
}
