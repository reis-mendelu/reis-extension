import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../store/useAppStore';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import { useTintedRooms } from './useTintedRooms';
import { roomPlanLabels, venueRoomKey } from './roomPlanLabel';
import { venueRoomTitles } from './venueSearch';
import { TiltToggle } from '../Building3D/tilt/TiltToggle';
import { drawPoiHighlight, outlineForSelection } from './poiOutline';
import { useCanvasRefs } from './useCanvasRefs';
import { useLeafletMap } from './useLeafletMap';
import { useMapScene } from './useMapScene';
import { useRoomSelection } from './useRoomSelection';
import { useRouteCamera } from './useRouteCamera';

/**
 * The campus map both trees render. Each concern is its own hook:
 *
 * - useLeafletMap builds the map once;
 * - useMapScene draws the overview or a floor (drawCampusOverview,
 *   drawFloorView) and is the one camera owner;
 * - useTintedRooms tints the library's rooms in place;
 * - useRoomSelection restyles a selection and pins the route chip;
 * - useRouteCamera draws a walk and fits the camera to it.
 */
export function MapCanvas() {
  const isPhone = usePhoneViewport();
  const refs = useCanvasRefs();
  const { ref, mapRef, railRef, roomPolysRef, poiHighlightRef, labelledRoomsRef } = refs;
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const mapSelection = useAppStore((s) => s.mapSelection);
  const venueKey = useAppStore((s) => venueRoomKey(s.venuePins));

  useLeafletMap(refs, isPhone);
  useMapScene(refs, isPhone);
  useTintedRooms({ polys: roomPolysRef, mapRef, railRef, isPhone, mapSelection });

  // A building with no outline of its own (D05 → building D) still has to
  // show which one it is; the camera move alone left the map looking unchanged.
  useEffect(() => {
    drawPoiHighlight(poiHighlightRef.current, outlineForSelection(mapSelection, activeBuildingId));
  }, [mapSelection, activeBuildingId, poiHighlightRef]);

  // Venues load beside the events, possibly after a plan is already open:
  // retitle its rooms in place. venueKey is a string, so a refetch of the same
  // venues does not get here.
  useEffect(() => {
    const titles = venueRoomTitles(useAppStore.getState().venuePins);
    for (const { poly, p, big } of labelledRoomsRef.current) {
      const { full, short } = roomPlanLabels(p, titles);
      poly.setTooltipContent(big ? short : full);
    }
  }, [venueKey, labelledRoomsRef]);

  useRoomSelection(refs, isPhone);
  useRouteCamera(refs, isPhone);

  return (
    <>
      <div ref={ref} className="absolute inset-0" />
      {/* Off unless VITE_MAP3D=1: a room in Q tilts the map into the building. */}
      <TiltToggle />
    </>
  );
}
