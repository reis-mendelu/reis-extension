import { useAppStore } from '../../store/useAppStore';
import { canBookLibrary } from './transport';
import { isDemoMode } from '../../errors/demoMode';
import type { MapSelection } from '../../types/campusMap';
import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';

// The card also opens from a tap on a library room of the floor plan, a search
// result or a deep link, in shared map code that cannot reach into the phone
// tree; the read follows the map's selection here instead of in a component
// effect (CLAUDE.md), behind the same gate as every other way in.
const libraryRoomIn = (sel: MapSelection | null): boolean => {
  if (sel?.kind === 'library') return true;
  const id =
    sel?.kind === 'room' ? sel.room.id : sel?.kind === 'roomRef' ? sel.entry.placeId : null;
  return LIBRARY_ROOMS.some((r) => r.featureId === id);
};
export function startLibraryWatch(load: () => void): void {
  useAppStore.subscribe((s, prev) => {
    // Arriving on the map tab starts the read too: about one in five map visitors
    // opens the card, and the seconds before they tap the pin are the library's
    // answering time. Not at app start: 99 in 100 of those would never look.
    const arrived = s.mobileTab === 'map' && prev.mobileTab !== 'map';
    const picked = s.mapSelection !== prev.mapSelection && libraryRoomIn(s.mapSelection);
    if (!arrived && !picked) return;
    if (canBookLibrary() && !isDemoMode()) load();
  });
}
