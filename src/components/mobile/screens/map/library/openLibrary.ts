import { useAppStore } from '../../../../../store/useAppStore';
import { LIBRARY_BUILDING_ID, LIBRARY_FLOOR_ID } from '../../../../../data/map/libraryRooms';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { libraryTints } from '../../../../../mobile/library/libraryModel';

export const todayIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The pin's tap: the camera goes to the library's rooms on building A, floor -1,
 * and the panel lists them. The building change clears the selection and the
 * floor change does it again, so the library selection goes last.
 *
 * The tints are set here as well as by `LibraryTints`: the canvas frames the
 * tinted rooms when it draws the floor, and a floor already in memory is drawn
 * in the same render the building changes in, before any effect of ours runs.
 */
export function openLibrary(): void {
  const app = useAppStore.getState();
  const now = new Date();
  app.setMapRoomTints(
    libraryTints(useLibraryStore.getState().blocks, todayIso(now), now, app.language)
  );
  app.setMapBuilding(LIBRARY_BUILDING_ID);
  app.setMapFloor(LIBRARY_FLOOR_ID);
  useAppStore.setState({ mapSelection: { kind: 'library', group: 'main' } });
}
