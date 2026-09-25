import L from 'leaflet';

/** What the floor-view fit leaves around a building, from the heavy effect's
 *  own focus padding — the zoom this compares against has to be the zoom the
 *  camera actually arrives at. */
const FOCUS_PADDING = 40;

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
 * NOT an absolute zoom floor, and `bubblesHidden` above documents why: the zoom
 * at which a building fills the frame depends on the viewport, so a constant
 * hides every label on the smaller screen.
 *
 * `null` bounds means no plan is open, so there is nothing to hide.
 */
export function roomLabelsHidden(map: L.Map, buildingBounds: L.LatLngBounds | null): boolean {
  if (!buildingBounds) return false;
  const fitZoom = map.getBoundsZoom(buildingBounds, false, L.point(FOCUS_PADDING, FOCUS_PADDING));
  return map.getZoom() < fitZoom;
}
