import type L from 'leaflet';
import { sheetClearancePanPx } from '../../utils/mapSheetClearance';

/**
 * On a phone, move a just-focused pin out from behind the map sheet.
 *
 * The phone's `railOffsetPx`: Leaflet centres on its whole container, and the
 * sheet is drawn over the bottom of it, so a list or notification tap put the
 * pin under the event card the same tap opened (390×844: pin 422, card top 373).
 *
 * Measured after two frames, not at the camera move. The card and the camera
 * answer the same store update, and the sheet only resizes to hug the card on
 * the render AFTER its own effect has set the detent — at the moment of the
 * move it is still the height it had before. Reading it from the DOM rather
 * than predicting it for the same reason the route fit does: a sheet that hugs
 * its content has no height anyone could compute ahead of layout.
 *
 * A no-op where there is no sheet: the tablet has the rail instead (already
 * handled by `railOffsetPx`) and the desktop tree has neither.
 *
 * `afterMs`: a tap on a pin the student can already see. Its sheet rises from
 * the peek over a 300ms height transition, so two frames in it is still low and
 * every pin reads as clear. `onlyIfCovered`: then leave the map alone unless
 * the risen sheet actually covers the pin — the map does not jump under a
 * finger that tapped something in plain view.
 */
export function panPinClearOfSheet(
  map: L.Map,
  pin: L.LatLngExpression,
  { afterMs = 0, onlyIfCovered = false }: { afterMs?: number; onlyIfCovered?: boolean } = {}
): void {
  // Two frames is long enough for the map to be torn down under us — switching
  // to the map tab mounts it, and a remount replaces the instance — and a
  // removed map throws on the first projection (`_leaflet_pos` of a pane that
  // is gone). Seen in the browser on the calendar and notification arrivals.
  let removed = false;
  const onUnload = () => {
    removed = true;
  };
  map.once('unload', onUnload);
  const run = () => {
    map.off('unload', onUnload);
    if (removed) return;
    const sheet = document.querySelector('[data-testid="map-sheet"]');
    if (!sheet) return;
    const container = map.getContainer();
    const origin = container.getBoundingClientRect().top;
    const search = container.parentElement?.querySelector('label');
    const topChrome = search ? search.getBoundingClientRect().bottom - origin : 0;
    const sheetTop = sheet.getBoundingClientRect().top - origin;
    const pinY = map.latLngToContainerPoint(pin).y;
    // A pin's face reaches ~20px below its point once chosen (and its name more).
    if (onlyIfCovered && pinY + 36 < sheetTop) return;
    const dy = sheetClearancePanPx(pinY, topChrome, sheetTop);
    if (dy) map.panBy([0, dy], { animate: false });
  };
  if (afterMs > 0) setTimeout(run, afterMs);
  else requestAnimationFrame(() => requestAnimationFrame(run));
}
