import { useEffect } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { libraryTints } from '../../../../../mobile/library/libraryModel';
import { canBookLibrary } from '../../../../../mobile/library/transport';
import { shownDay } from '../../../../../mobile/library/libraryDay';
import { LIBRARY_BUILDING_ID, LIBRARY_FLOOR_ID } from '../../../../../data/map/libraryRooms';

/**
 * Colours and names the six bookable rooms while building A's floor -1 is open:
 * green with an hour to book on the shown day, grey without, faint and dashed
 * while the library has not answered. Renders nothing; it only hands the map's `mapRoomTints` to the
 * canvas, which paints in place without moving the camera.
 */
export function LibraryTints() {
  const blocks = useLibraryStore((s) => s.blocks);
  const building = useAppStore((s) => s.activeBuildingId);
  const floor = useAppStore((s) => s.activeFloorId);
  const language = useAppStore((s) => s.language);
  const set = useAppStore((s) => s.setMapRoomTints);
  const open = canBookLibrary() && building === LIBRARY_BUILDING_ID && floor === LIBRARY_FLOOR_ID;
  useEffect(() => {
    const now = new Date();
    set(open ? libraryTints(blocks, shownDay(now).day, now, language) : {});
    return () => set({});
  }, [open, blocks, language, set]);
  return null;
}
