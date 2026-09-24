/**
 * The smallest strip worth centring a pin in. Below this the sheet has been
 * dragged up to the search bar, or one of the two has not laid out yet, and a
 * "middle" is a guess.
 */
const MIN_STRIP_PX = 48;

/**
 * How far to pan (Leaflet `panBy` y, positive moves the view down and so the
 * content up) so that a pin at `pinY` sits in the middle of the map the phone
 * leaves visible: below the floating search bar (`topChromeBottom`) and above
 * the sheet (`sheetTop`). All three are pixels from the map container's top.
 *
 * The phone counterpart of `railOffsetPx`: the rail covers the map's right on a
 * tablet, the sheet covers its bottom on a phone, and in both Leaflet centres on
 * a container the student cannot fully see. Measured at 390×844 before this: an
 * Akce-list tap put the pin at y=422 under an event card topped at 373.
 */
export function sheetClearancePanPx(
  pinY: number,
  topChromeBottom: number,
  sheetTop: number
): number {
  if (sheetTop - topChromeBottom < MIN_STRIP_PX) return 0;
  return Math.round(pinY - (topChromeBottom + sheetTop) / 2);
}
