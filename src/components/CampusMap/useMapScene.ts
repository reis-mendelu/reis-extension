import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { drawCampusOverview } from './drawCampusOverview';
import { drawFloorView } from './drawFloorView';
import type { CanvasRefs } from './useCanvasRefs';

/**
 * The map's one camera owner: draws the campus overview or the active floor
 * and decides where the camera goes. A second effect moving the camera races
 * this one (see the draft note in drawCampusOverview).
 */
export function useMapScene(refs: CanvasRefs, isPhone: boolean): void {
  const { mapRef, layerRef, keepViewRef, exitHandlerRef } = refs;
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  const focusReq = useAppStore((s) => s.mapFocusRequest);
  // The event being composed is read through refs.draftCoordRef: this effect
  // is the app's only camera owner, and a second one racing it is exactly how
  // "Ukázat na mapě" ended up drawing the pin while the camera sat on the
  // campus overview.
  const focusTarget = useAppStore((s) => s.mapFocusTarget);

  // draw campus overview or the active floor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = layerRef.current;
    layer.clearLayers();
    // A room's name card is anchored to a room this redraw just removed.
    map.closePopup();
    const select = useAppStore.getState();
    // Leaving floor-view by tapping the basemap keeps the camera; the "Celý
    // kampus" button still re-fits the campus. Cleared where the camera
    // decision is reached rather than here.
    const cameFromMapTap = keepViewRef.current;
    if (exitHandlerRef.current) {
      map.off('click', exitHandlerRef.current);
      exitHandlerRef.current = null;
    }

    if (activeBuildingId === null) {
      drawCampusOverview({ map, layer, select, refs, isPhone, focusTarget, cameFromMapTap });
      return;
    }
    drawFloorView({
      map,
      layer,
      select,
      refs,
      isPhone,
      activeBuildingId,
      activeFloorId,
      roomsByBuilding,
    });
    // isPhone joins the deps because the rail offset reads it. It is stable
    // for the life of a device, but it flips on a browser resize, and this
    // effect is idempotent by design (see the 'draft' branch's note), so
    // re-running it on that flip re-answers the same question correctly.
    //
    // The rail's width and open state deliberately do NOT: they are read from
    // `railRef` at the moment of focus. As dependencies they made a resize drag
    // re-run this whole effect sixty times a second, and it resets the camera.
    //
    // `refs` and the refs in it are one object for the life of the canvas.
  }, [
    activeBuildingId,
    activeFloorId,
    roomsByBuilding,
    focusReq,
    focusTarget,
    isPhone,
    refs,
    mapRef,
    layerRef,
    keepViewRef,
    exitHandlerRef,
  ]);
}
