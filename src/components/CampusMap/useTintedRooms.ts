import { useEffect, type RefObject } from 'react';
import type L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import { SELECTED_STYLE } from './mapHelpers';
import {
  applyRoomTints,
  declutterTintLabels,
  selectedRoomId,
  tintedBoundsOf,
  type RoomPoly,
} from './roomTints';
import { dimsOtherRooms } from './dimsOtherRooms';
import { groupFocusView } from './focusBounds';
import { fitAboveSheet } from './sheetClearance';
import { railPaddingPx } from '../../utils/mapRail';
import type { MapSelection } from '../../types/campusMap';

/**
 * The rooms a screen tints on the open floor (only the library's six, phone and
 * iPad), kept out of MapCanvas so drawing, selection and this stay separate:
 *
 * - tints arrive after the floor is drawn as often as before it (the library's
 *   free hours take 10–16 s), so they are applied in place, camera untouched;
 * - while the library's card is open, a room chosen from it closes the camera
 *   in on that room, and going back frames all six, above the sheet or left of
 *   the rail.
 */
export function useTintedRooms({
  polys,
  mapRef,
  railRef,
  isPhone,
  mapSelection,
}: {
  polys: RefObject<Map<number, RoomPoly>>;
  mapRef: RefObject<L.Map | null>;
  railRef: RefObject<{ width: number; open: boolean }>;
  isPhone: boolean;
  mapSelection: MapSelection | null;
}): void {
  const roomTints = useAppStore((s) => s.mapRoomTints);

  useEffect(() => {
    applyRoomTints(
      polys.current,
      roomTints,
      selectedRoomId(mapSelection),
      SELECTED_STYLE,
      dimsOtherRooms(mapSelection, roomTints)
    );
    declutterTintLabels(polys.current, roomTints, selectedRoomId(mapSelection));
  }, [roomTints, mapSelection, polys]);

  useEffect(() => {
    const lens = mapRef.current;
    if (mapSelection?.kind !== 'library' || !lens) return;
    const tints = useAppStore.getState().mapRoomTints;
    const chosen = polys.current.get(selectedRoomId(mapSelection) ?? -1)?.poly;
    const box = chosen?.getBounds() ?? tintedBoundsOf(polys.current, tints);
    if (!box) return;
    const rail = railPaddingPx(
      lens.getSize().x,
      isPhone,
      railRef.current.width,
      railRef.current.open
    );
    const view = groupFocusView<L.LatLngBoundsExpression>(box, rail);
    lens.fitBounds(view.bounds, {
      maxZoom: view.maxZoom,
      paddingTopLeft: view.paddingTopLeft,
      paddingBottomRight: view.paddingBottomRight,
      animate: false,
    });
    // Only while this is still the selection: another building picked within
    // the 350 ms must not be pulled back to the library.
    if (isPhone)
      fitAboveSheet(
        lens,
        box,
        view.maxZoom,
        () => useAppStore.getState().mapSelection === mapSelection
      );
  }, [mapSelection, isPhone, mapRef, railRef, polys]);
}
