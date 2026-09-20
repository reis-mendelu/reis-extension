import L from 'leaflet';
import { BUILDING_STYLE } from './mapHelpers';

/**
 * "Now pick where you are going" — said with the buildings themselves.
 *
 * The first attempt drew an orange lettered pill on each building. It sat on
 * top of the letter the building already draws, so every building said its name
 * twice, and seven badges is a lot of furniture for a question that lasts one
 * tap. The outlines are already there and already mean "this is a building you
 * can choose" — so they just light up instead.
 *
 * While a gate is chosen, a tap on a building answers the second question
 * rather than drilling into its floor plan. That branch lives in MapCanvas's
 * click handler, which reads the live entrance from a ref.
 */

/** Every building, while the map is waiting for you to choose one. */
export const PICKABLE_BUILDING_STYLE: L.PathOptions = {
  ...BUILDING_STYLE,
  color: '#ea580c',
  weight: 2.5,
  fillColor: '#fb923c',
  fillOpacity: 0.16,
};

/** The one you chose. */
export const PICKED_BUILDING_STYLE: L.PathOptions = {
  ...BUILDING_STYLE,
  color: '#c2410c',
  weight: 4,
  fillColor: '#fb923c',
  fillOpacity: 0.55,
};

/**
 * Restyles the building outlines for whichever step the student is on.
 *
 * A restyle, never a redraw: the effect that redraws also owns the camera, and
 * re-running it on a tap throws away the view the student is looking at.
 */
export function markPickableBuildings(
  polys: Map<string, L.Polygon>,
  entrance: string | null,
  picked: string | null
): void {
  for (const [name, poly] of polys) {
    if (!entrance) {
      poly.setStyle(BUILDING_STYLE);
      continue;
    }
    poly.setStyle(name === picked ? PICKED_BUILDING_STYLE : PICKABLE_BUILDING_STYLE);
    if (name === picked) poly.bringToFront();
  }
}
