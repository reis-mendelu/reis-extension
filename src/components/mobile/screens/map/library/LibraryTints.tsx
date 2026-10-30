import { useEffect } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { libraryTints } from '../../../../../mobile/library/libraryModel';
import { canBookLibrary } from '../../../../../mobile/library/transport';
import { LIBRARY_BUILDING_ID, LIBRARY_FLOOR_ID } from '../../../../../data/map/libraryRooms';

const todayIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Colours and names the six bookable rooms while building A's floor -1 is open:
 * blue for individual rooms, green for team rooms, grey once a room has nothing
 * left today. Renders nothing; it only hands the map's `mapRoomTints` to the
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
    set(open ? libraryTints(blocks, todayIso(new Date()), new Date(), language) : {});
    return () => set({});
  }, [open, blocks, language, set]);
  return null;
}
