/**
 * The map's event panel, and how much of the canvas it covers.
 *
 * On a phone it is a bottom sheet with detents. On a tablet — which runs the
 * same phone tree — that sheet was forced to its tallest stop whenever an event
 * was selected, so most of an 1112px screen became a card holding four short
 * lines, and the map it described was pushed out of sight. A tablet has width
 * going spare and no height to waste, so the card takes a column instead.
 *
 * The rail FLOATS rather than docking: inset on three sides, fully rounded.
 * That is not decoration, it is this screen's existing idiom — the search bar
 * is already a rounded pill floating over the canvas with a margin, and a
 * panel welded to the edge beside it reads as a different app's furniture.
 * The inset is also what keeps the map continuous behind it, which is the whole
 * reason the rail exists.
 */

/** Where the rail starts, and where it returns after a reset. */
export const RAIL_PX = 340;

/** Tailwind's `md`. The rail's layout is CSS, so the JS that compensates the
 *  camera for it has to flip at exactly the same width, or a focused pin lands
 *  under the rail for one breakpoint's worth of viewports. */
export const RAIL_MIN_WIDTH = 768;

/** Narrower than this and the event card's two RSVP buttons stop fitting side
 *  by side; wider and the rail stops being a rail. The upper bound also yields
 *  to small tablets, where a fixed 560 would eat most of the map. */
export const RAIL_MIN_PX = 300;
export const RAIL_MAX_PX = 560;

/**
 * The gap the rail floats in, matching its own `right-4`.
 *
 * It does not dock: it is inset on three sides and fully rounded, so the band
 * of canvas it occupies is its width PLUS this. Reserving only the width left
 * the room pill 12px under the panel in phone landscape — clamped to 504 on an
 * 844px map, with the rail's left edge at 488.
 */
export const RAIL_INSET_PX = 16;

/** Never let the rail take more than this share of the screen — the map is the
 *  point, and a rail past half is a list with a map accessory. */
const RAIL_MAX_SHARE = 0.5;

/**
 * What the rail's width becomes when the student drags its edge.
 *
 * Pure so the drag handler stays a two-line pointer listener and the rules
 * live somewhere a test can reach them.
 */
export function clampRailWidth(desired: number, viewportWidth: number): number {
  const ceiling = Math.min(RAIL_MAX_PX, Math.max(RAIL_MIN_PX, viewportWidth * RAIL_MAX_SHARE));
  if (!Number.isFinite(desired)) return RAIL_PX;
  return Math.round(Math.min(ceiling, Math.max(RAIL_MIN_PX, desired)));
}

/**
 * How far to shift the camera east so a focused pin lands in the middle of the
 * VISIBLE map rather than the middle of the container.
 *
 * The rail overlays the canvas — Leaflet still owns the full width and centres
 * on it — so without this a focused event sits under the rail on exactly the
 * screens the rail exists for. Half the rail's width re-centres the pin in
 * what is left, and it takes the LIVE width because the student can drag it.
 *
 * Zero unless the rail is actually there: the desktop tree floats its own
 * DetailPanel and must not be nudged, a phone's sheet is below the map rather
 * than beside it, and a CLOSED rail covers nothing at all — shifting the camera
 * for a panel that is not on screen puts the pin off-centre for no reason.
 */
export function railOffsetPx(
  containerWidth: number,
  isPhoneTree: boolean,
  railWidth: number = RAIL_PX,
  railOpen: boolean = true
): number {
  if (!isPhoneTree) return 0;
  if (!railOpen) return 0;
  if (containerWidth < RAIL_MIN_WIDTH) return 0;
  return Math.round(railWidth / 2);
}

/**
 * How much of the map's WIDTH the rail is covering, for a fit that has to keep
 * its whole subject visible.
 *
 * `railOffsetPx` above answers a different question — how far to nudge a
 * centred pin out from behind the rail — and takes half the width because
 * re-centring in the remaining space is exactly half. Fitting a route is not a
 * nudge: every metre of the walk has to end up on screen, so the padding is the
 * whole rail.
 *
 * Same three gates as the offset, and they are the point. The rail's width
 * lives in the store, where it defaults to open at 340px regardless of the
 * screen it is not being rendered on; the route fit used to read it raw. On a
 * 390px phone that asked Leaflet to fit a walk into 390 - 28 - 28 - 340 = -6px
 * of map. Given nothing to fit into, `getBoundsZoom` returns its maximum, the
 * fit becomes a no-op, and the camera stays on whatever the student was looking
 * at before — a "9 min" card above a line that runs off the screen.
 *
 * Capped at half the container for the same reason the rail's own width is:
 * a fit needs a map left over to fit into.
 */
export function railPaddingPx(
  containerWidth: number,
  isPhoneTree: boolean,
  railWidth: number = RAIL_PX,
  railOpen: boolean = true
): number {
  if (!isPhoneTree) return 0;
  if (!railOpen) return 0;
  if (containerWidth < RAIL_MIN_WIDTH) return 0;
  return Math.round(Math.min(railWidth + RAIL_INSET_PX, containerWidth * RAIL_MAX_SHARE));
}
