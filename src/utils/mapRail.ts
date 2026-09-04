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
 * DetailPanel and must not be nudged, and a phone's sheet is below the map,
 * not beside it.
 */
export function railOffsetPx(
  containerWidth: number,
  isPhoneTree: boolean,
  railWidth: number = RAIL_PX
): number {
  if (!isPhoneTree) return 0;
  if (containerWidth < RAIL_MIN_WIDTH) return 0;
  return Math.round(railWidth / 2);
}
