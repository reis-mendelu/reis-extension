import L from 'leaflet';
import { CAMPUS_DESTINATIONS } from './pathLayers';

/**
 * Marks the places the campus walks run between.
 *
 * Only the ones the map does not already name. A lettered building draws its
 * letter in its own centre, so a pill saying "A" on top of the A is a second
 * label for something already labelled — the first cut did exactly that and the
 * two collided. What is left is what a student would otherwise have to guess
 * at: the gates, the tram stop, the arboretum entrance, the one campus building
 * with no letter on it.
 *
 * Non-interactive on purpose. These sit ON the trail, and a marker that ate the
 * tap would stop the path underneath it from being selectable — the paths are
 * the thing you tap here.
 */
const DOT_STYLE: L.CircleMarkerOptions = {
  radius: 3.8,
  color: '#78716c',
  weight: 2,
  fillColor: '#ffffff',
  fillOpacity: 1,
  interactive: false,
};

export const LABELLED_DESTINATIONS = CAMPUS_DESTINATIONS.filter((p) => p.kind !== 'building');

export function drawCampusPlaces(layer: L.LayerGroup): L.CircleMarker[] {
  return LABELLED_DESTINATIONS.map((place) => {
    const dot = L.circleMarker([place.lat, place.lon], DOT_STYLE)
      .bindTooltip(place.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -4],
        className: 'place-label',
      })
      .addTo(layer);
    return dot;
  });
}
