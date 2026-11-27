import { useEffect } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { cardPick } from '../../../../../mobile/library/libraryDay';
import { libraryTints } from '../../../../../mobile/library/libraryModel';
import { canBookLibrary } from '../../../../../mobile/library/transport';
import { isDemoMode } from '../../../../../errors/demoMode';
import { withOwnBookings } from '../../../../../mobile/library/libraryHours';
import { LIBRARY_BUILDING_ID, LIBRARY_FLOOR_ID } from '../../../../../data/map/libraryRooms';

/**
 * Colours and names the six bookable rooms while building A's floor -1 is open:
 * green with an hour to book on the card's day (or free for all of the picked
 * hours once there are some), grey without, faint and dashed while the library
 * has not answered. Renders nothing; it only hands the map's `mapRoomTints` to the
 * canvas, which paints in place without moving the camera.
 */
export function LibraryTints() {
  const raw = useLibraryStore((s) => s.blocks);
  const mine = useAppStore((s) => s.customEvents);
  const day = useLibraryStore((s) => s.day);
  const picked = useLibraryStore((s) => s.picked);
  const building = useAppStore((s) => s.activeBuildingId);
  const floor = useAppStore((s) => s.activeFloorId);
  const language = useAppStore((s) => s.language);
  const set = useAppStore((s) => s.setMapRoomTints);
  const open =
    canBookLibrary() &&
    !isDemoMode() &&
    building === LIBRARY_BUILDING_ID &&
    floor === LIBRARY_FLOOR_ID;
  useEffect(() => {
    const now = new Date();
    const blocks = withOwnBookings(raw, mine);
    const pick = cardPick({ day, picked }, now);
    set(open ? libraryTints(blocks, pick.day, now, language, pick.picked) : {});
    return () => set({});
  }, [open, raw, mine, day, picked, language, set]);
  return null;
}
