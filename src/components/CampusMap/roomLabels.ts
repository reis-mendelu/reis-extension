import L from 'leaflet';
import { PLAN_FOCUS_MAX_ZOOM } from './focusBounds';

/** Kept as it was, deliberately: this is the comparison every phone has been
 *  judged by, and a phone must not change. It is NOT the padding the camera
 *  fits a plan with (roomFocusView's 60 per side plus the rail), which is why
 *  the two other tests below exist. */
const FOCUS_PADDING = 40;

/**
 * How big a building has to be drawn, its longer side in CSS px, before its
 * room names are worth showing even though it does not fill the screen yet.
 *
 * Measured, not chosen: every floor of all eight buildings, names counted as
 * overlapping when their boxes touch. At 274px (Q at zoom 18, the size a 390px
 * phone opens Q at) a third of Q's names touch another; at 137px it is 85%;
 * M at 229px is 61%; every building at twice those sizes is at 0–3%. So 250
 * lets through what a phone already shows and nothing denser.
 */
export const READABLE_PLAN_PX = 250;

/**
 * Whether the floor plan's room names should be hidden right now.
 *
 * The same question the garden's bubbles ask, for the same reason: "is this
 * drawn smaller than the view it opens at?" A floor plan used to be seen only
 * while the camera was on its building, so the question never came up — until
 * a route started fitting the whole walk, which zooms the camera out with the
 * plan still open. Measured at that moment: fifteen room names ("Počítačová
 * studovna", "Q1.36", "Q02") stacked over the very building the walk ends at,
 * which is the one place on the screen the student is looking.
 *
 * NOT an absolute zoom floor, and `bubblesHidden` documents why: the zoom at
 * which a building fills the frame depends on the viewport, so a constant hides
 * every label on the smaller screen.
 *
 * But "fills the screen" alone is wrong on a BIG screen. On a 1782x919 Mac
 * window Q fills the frame only at zoom 20, so its names were missing at 18,
 * where Q is the same 274px a phone opens it at with its names on. Two more
 * ways to count as readable, then, neither of which a phone can reach before
 * its own fit zoom (it is narrower than twice READABLE_PLAN_PX):
 *
 * - the building is drawn at least READABLE_PLAN_PX across, or
 * - the camera is at PLAN_FOCUS_MAX_ZOOM, the ceiling of a building fit
 *   (roomFocusView). A small building (E, 204px there) otherwise never qualified on a
 *   window big enough to fit it closer.
 *
 * A zoomed-out route fit still draws the plan far below both, so it still
 * hides the names.
 *
 * `null` bounds means no plan is open, so there is nothing to hide.
 */
export function roomLabelsHidden(map: L.Map, buildingBounds: L.LatLngBounds | null): boolean {
  if (!buildingBounds) return false;
  const zoom = map.getZoom();
  const fitZoom = map.getBoundsZoom(buildingBounds, false, L.point(FOCUS_PADDING, FOCUS_PADDING));
  if (zoom >= Math.min(fitZoom, PLAN_FOCUS_MAX_ZOOM)) return false;
  return drawnSidePx(map, buildingBounds, zoom) < READABLE_PLAN_PX;
}

/** The building's longer side on screen, at `zoom`. */
function drawnSidePx(map: L.Map, bounds: L.LatLngBounds, zoom: number): number {
  const a = map.project(bounds.getNorthWest(), zoom);
  const b = map.project(bounds.getSouthEast(), zoom);
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}
