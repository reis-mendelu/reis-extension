import { useAppStore } from '../../../../../store/useAppStore';
import { LIBRARY_BUILDING_ID, LIBRARY_FLOOR_ID } from '../../../../../data/map/libraryRooms';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { libraryTints } from '../../../../../mobile/library/libraryModel';
import { shownDay } from '../../../../../mobile/library/libraryDay';

/**
 * Opens the library card: the camera goes to the six rooms on building A,
 * floor −1, and the panel lists them, or shows `featureId` when given (a search
 * result for one room). The building change clears the selection and the floor
 * change does it again, so the library selection goes last.
 *
 * The tints are set here as well as by `LibraryTints`: the canvas frames the
 * tinted rooms when it draws the floor, and a floor already in memory is drawn
 * in the same render the building changes in, before any effect of ours runs.
 */
export function openLibrary(featureId?: number): void {
  const app = useAppStore.getState();
  const now = new Date();
  app.setMapRoomTints(
    libraryTints(useLibraryStore.getState().blocks, shownDay(now), now, app.language)
  );
  app.setMapBuilding(LIBRARY_BUILDING_ID);
  app.setMapFloor(LIBRARY_FLOOR_ID);
  app.selectMapLibrary(featureId);
}
