import { useAppStore } from '../../../../../store/useAppStore';
import { LIBRARY_BUILDING_ID, LIBRARY_FLOOR_ID } from '../../../../../data/map/libraryRooms';

/**
 * The pin's tap: the camera goes to building A, floor -1, and the panel lists
 * the rooms. The building change clears the selection and the floor change
 * does it again, so the library selection goes last.
 */
export function openLibrary(): void {
  const app = useAppStore.getState();
  app.setMapBuilding(LIBRARY_BUILDING_ID);
  app.setMapFloor(LIBRARY_FLOOR_ID);
  useAppStore.setState({ mapSelection: { kind: 'library' } });
}
