import { useAppStore } from '../../../../../store/useAppStore';
import { LIBRARY_BUILDING_ID, LIBRARY_FLOOR_ID } from '../../../../../data/map/libraryRooms';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { cardPick } from '../../../../../mobile/library/libraryDay';
import { libraryTints } from '../../../../../mobile/library/libraryModel';
import { withOwnBookings } from '../../../../../mobile/library/libraryHours';
import { getMapInstance } from '../../../../CampusMap/mapInstance';
import { panPinClearOfSheet } from '../../../../CampusMap/sheetClearance';

/**
 * The study rooms themselves: the middle of Týmová 1/2 and Individuální 1/2 on
 * the left of building A, from their floor-plan polygons (2026-11-16). The pin
 * sits there, like every other place pin sits on its place.
 */
export const LIBRARY_COORD: [number, number] = [16.615184, 49.209955];

/**
 * Opens the library card. Without a room the map stays on the campus with the
 * library in view: six rooms drawn small on a floor plan said nothing to a
 * student who has not picked a time yet (Dominik on the Pixel, 2026-11-16).
 * With a room (one picked from the free list, or found by search) the camera
 * goes to building A, floor −1, and closes in on it.
 *
 * The tints are set here as well as by `LibraryTints`: the canvas frames the
 * tinted rooms when it draws the floor, and a floor already in memory is drawn
 * in the same render the building changes in, before any effect of ours runs.
 * The building change clears the selection, so the selection goes last.
 */
export function openLibrary(featureId?: number): void {
  // The free hours are read where the library is opened, never by a component
  // effect (CLAUDE.md); a fresh read inside STALE_MS is a no-op in the store.
  void useLibraryStore.getState().load();
  const app = useAppStore.getState();
  if (featureId === undefined) {
    app.selectMapLibrary();
    const map = getMapInstance();
    if (map && app.activeBuildingId === null)
      panPinClearOfSheet(map, [LIBRARY_COORD[1], LIBRARY_COORD[0]], {
        afterMs: 350,
        onlyIfCovered: true,
      });
    return;
  }
  const lib = useLibraryStore.getState();
  const now = new Date();
  const pick = cardPick(lib, now);
  app.setMapRoomTints(
    libraryTints(
      withOwnBookings(lib.blocks, app.customEvents),
      pick.day,
      now,
      app.language,
      pick.picked
    )
  );
  if (app.activeBuildingId !== LIBRARY_BUILDING_ID) app.setMapBuilding(LIBRARY_BUILDING_ID);
  if (useAppStore.getState().activeFloorId !== LIBRARY_FLOOR_ID) app.setMapFloor(LIBRARY_FLOOR_ID);
  app.selectMapLibrary(featureId);
}

/** Opens a booking's drawer, reading the free hours its "Prodloužit" needs. */
export function openBooking(eventId: string): void {
  void useLibraryStore.getState().load();
  useAppStore.getState().pushSheet({ kind: 'libraryBooking', eventId });
}
