import { LIBRARY_ROOMS } from '../../../../../data/map/libraryRooms';
import type { MapSelection } from '../../../../../types/campusMap';

/** What the map's panel shows of the library: its list (`featureId: null`) or one room. */
export interface LibraryView {
  featureId: number | null;
}

const isLibraryRoom = (id: number | undefined) => LIBRARY_ROOMS.some((r) => r.featureId === id);

/**
 * The library card's view for a selection, if it is the library's. A bookable
 * room reached any other way (search, a deep link) opens the same room view.
 */
export function libraryOf(selection: MapSelection | null): LibraryView | null {
  if (selection?.kind === 'library')
    return { featureId: isLibraryRoom(selection.featureId) ? selection.featureId! : null };
  if (selection?.kind === 'room' && isLibraryRoom(selection.room.id))
    return { featureId: selection.room.id };
  if (selection?.kind === 'roomRef' && isLibraryRoom(selection.entry.placeId))
    return { featureId: selection.entry.placeId };
  return null;
}
