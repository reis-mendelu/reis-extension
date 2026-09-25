import type { BuildingsMeta } from '../../types/campusMap';
import type { MapSlice } from '../types';
import type { RoomPlace } from '../../utils/rooms/lookupRoomPlace';
import buildingsJson from '../../data/map/buildings.json';

const META = buildingsJson as BuildingsMeta;

type Focus = Pick<
  MapSlice,
  'focusPoiById' | 'focusLandmarkById' | 'focusRemotePlaceById' | 'focusPoint'
>;

/**
 * Fly to the building or campus a room without a floor plan is in, and name the
 * room on the selection — the card then reads "T18 · Budova T" rather than just
 * "T", which the student did not ask about.
 *
 * Each kind reuses the focus the map already has for that place, so the camera
 * and card behave exactly as for a search hit; `forRoom` is patched on after.
 * A room in one of the seven mapped buildings that the map does not draw
 * ("Velká zasedačka PEF" in Q)
 * gets the building's centre, the same point its outline is labelled at.
 */
export function focusRoomPlace(
  place: RoomPlace,
  focus: Focus,
  patch: (forRoom: string) => void
): void {
  if (place.kind === 'poi') focus.focusPoiById(place.id);
  else if (place.kind === 'landmark') focus.focusLandmarkById(place.id);
  else if (place.kind === 'remote') focus.focusRemotePlaceById(place.id);
  else {
    const b = META.buildings.find((x) => x.id === place.id);
    if (!b) return;
    focus.focusPoint(b.name, [b.center[1], b.center[0]]); // center is [lat, lng]
  }
  patch(place.label);
}
