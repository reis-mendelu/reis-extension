import type L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import type { AppState } from '../../store/types';
import { railPaddingPx } from '../../utils/mapRail';
import { flyAndReveal } from './mapLayers';
import { tintedBoundsOf, type RoomPoly } from './roomTints';
import { roomFocusView, groupFocusView } from './focusBounds';
import { fitAboveSheet } from './sheetClearance';

/**
 * Where the camera goes when a floor is drawn: the selected room's building,
 * or, with the library's card open, the room picked from it or all six tinted
 * rooms (above the sheet on a phone). Part of drawFloorView.
 */
export function frameFloor(a: {
  map: L.Map;
  isPhone: boolean;
  sel: AppState['mapSelection'];
  polys: Map<number, RoomPoly>;
  tints: AppState['mapRoomTints'];
  targetBounds: L.LatLngBounds | null;
  buildingBounds: L.LatLngBoundsExpression | null;
  rail: { width: number; open: boolean };
}): void {
  const { map, isPhone, sel, polys, tints, targetBounds, buildingBounds, rail: railState } = a;
  // The library's card frames the room picked from it, or all six, not the building.
  const tinted =
    sel?.kind === 'library'
      ? // A room chosen from the card (the floor opens at that moment) is the
        // frame; otherwise all six.
        (targetBounds ?? tintedBoundsOf(polys, tints))
      : null;
  const rail = railPaddingPx(map.getSize().x, isPhone, railState.width, railState.open);
  // Which box to frame is a decision, so it lives in a tested pure module:
  // a selected room frames its BUILDING, not its own few metres of floor.
  // See focusBounds.roomFocusView.
  const view = tinted
    ? groupFocusView<L.LatLngBoundsExpression>(tinted, rail)
    : roomFocusView<L.LatLngBoundsExpression>(targetBounds ?? null, buildingBounds, rail);
  if (view) {
    const { bounds, maxZoom, paddingTopLeft, paddingBottomRight } = view;
    flyAndReveal(map, () =>
      map.fitBounds(bounds, { maxZoom, paddingTopLeft, paddingBottomRight, animate: false })
    );
  }
  // The card hugs the lower part of a phone's screen: the rooms go above it.
  if (isPhone && tinted)
    fitAboveSheet(
      map,
      tinted,
      view?.maxZoom ?? 21,
      () => useAppStore.getState().mapSelection === sel
    );
}
