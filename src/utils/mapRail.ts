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

/** The floor column's own inset from the right edge, its `right-3`. */
export const FLOOR_COLUMN_RIGHT_PX = 12;

/** How far the floor column stands off the bottom on a touch screen, clear of
 *  the sheet's peek and the floating BottomNav. FloorSwitcher's `bottom-[…]`. */
export const FLOOR_COLUMN_BOTTOM_PX = 190;

/** The gap the open rail keeps above the floor column — the column's own 12px
 *  from the edge, turned on its side. */
const RAIL_FLOOR_GAP_PX = 12;

/**
 * Shorter than this and the screen is a phone on its side, not a tablet. The
 * tallest phone in landscape is ~440px; the shortest iPad, a mini in
 * landscape, is 744.
 */
export const RAIL_YIELDS_MIN_HEIGHT = 600;

/**
 * The floor column's height: FloorStack's `p-1` (4px top and bottom), one
 * `btn-xs` (24px) per row, `gap-1` (4px) between rows. A row is a floor, plus
 * the 3D/2D switch when the building has a model. Building Q's eight floors
 * are 228px, which is what the browser measures at 1080x810.
 */
export function floorColumnHeightPx(rows: number): number {
  if (rows <= 0) return 0;
  return 8 + rows * 24 + (rows - 1) * 4;
}

/**
 * The open rail's max-height.
 *
 * The rail floats from the top, capped at 55vh; the floor column stands at the
 * right edge 190px off the bottom, where the phone keeps it. On an iPad in
 * landscape (1080x810, 1194x834, 1024x768) the two share a band of that edge,
 * and building Q's floors 5 to 2 sat under the rail where no tap could reach
 * them.
 *
 * #473 answered that by moving the COLUMN to the rail's left edge whenever the
 * rail was open, overlapping or not. That stood it in the middle of the map —
 * on an iPad 8 in portrait 368px off the edge with 270px of empty screen
 * between it and the rail. So the RAIL yields instead: while a building is
 * open it stops 12px above the column and scrolls inside itself, which it
 * already does past 55vh.
 *
 * `100%` is the map screen, the containing block of both. The rail's top is
 * its `top-[calc(5rem_+_var(--safe-top))]`, the column's bottom its
 * `bottom-[calc(190px_+_var(--safe-bottom))]`.
 *
 * `floorRows` is null when no column stands at the right edge: no building is
 * open, or there is no touch screen (the Mac puts the column top-left). A
 * phone on its side is too short for both and is left as it was.
 */
export function railMaxHeight(viewportHeight: number, floorRows: number | null): string {
  if (floorRows === null || floorRows <= 0) return '55vh';
  if (viewportHeight < RAIL_YIELDS_MIN_HEIGHT) return '55vh';
  const below = FLOOR_COLUMN_BOTTOM_PX + floorColumnHeightPx(floorRows) + RAIL_FLOOR_GAP_PX;
  return `min(55vh, calc(100% - 5rem - var(--safe-top, 0px) - var(--safe-bottom, 0px) - ${below}px))`;
}

export type FloorColumnPlacement =
  { side: 'left'; size: 'sm' } | { side: 'right'; rightPx: number; size: 'xs' };

/**
 * Where the floor column stands, and how big its buttons are.
 *
 * Every touch screen, phone or iPad, rail open or not: the right edge, where
 * the phone has always kept it. The open rail makes room (`railMaxHeight`).
 *
 * Without a touch screen it is the iPad app on a Mac: the phone tree, a mouse,
 * and a window around 1782x919 that the system draws at 0.825. There it goes
 * under the search bar on the left, where the extension's map already keeps
 * it and nothing else on this screen lives, and takes btn-sm — 24px buttons
 * show as 20pt there.
 *
 * `isTouch` is the store's `pointer: coarse`, the same test the Mac's visible
 * refresh button uses.
 */
export function floorColumnPlacement(isTouch: boolean): FloorColumnPlacement {
  if (!isTouch) return { side: 'left', size: 'sm' };
  return { side: 'right', rightPx: FLOOR_COLUMN_RIGHT_PX, size: 'xs' };
}
