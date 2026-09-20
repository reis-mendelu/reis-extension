import L from 'leaflet';
import { CAMPUS_ENTRANCES } from './pathLayers';

/**
 * The ways onto the campus, as tappable points.
 *
 * These are the only markers on the map. Buildings already draw their own
 * letters, and a marker in the middle of the campus answers nothing — you do
 * not arrive there. What a student cannot guess is which of the six openings in
 * the perimeter is the one to use, so those are marked and everything else is
 * left to the buildings.
 *
 * The NAME is on hover, not permanent: six labels sitting on the map all the
 * time is a ring of text round a campus, and the dot alone already says "you
 * can get in here". On a phone there is no hover, so the tap that reveals the
 * name is the same tap that draws the walks — which is the better trade anyway.
 */
const DOT_STYLE: L.CircleMarkerOptions = {
  radius: 5,
  color: '#78716c',
  weight: 2.2,
  fillColor: '#ffffff',
  fillOpacity: 1,
  // These sit ON the trail and must answer the tap; without this the same tap
  // also reaches the map's own handler, which clears the selection it just made.
  bubblingMouseEvents: false,
};
const ACTIVE_STYLE: L.CircleMarkerOptions = {
  ...DOT_STYLE,
  radius: 6.5,
  color: '#ea580c',
  weight: 3,
};

export function drawCampusEntrances(
  layer: L.LayerGroup,
  onSelect: (name: string) => void
): Map<string, L.CircleMarker> {
  const marks = new Map<string, L.CircleMarker>();
  for (const entrance of CAMPUS_ENTRANCES) {
    const dot = L.circleMarker([entrance.lat, entrance.lon], DOT_STYLE)
      .bindTooltip(entrance.name, { direction: 'top', offset: [0, -4], className: 'place-label' })
      .on('click', () => onSelect(entrance.name))
      .addTo(layer);
    marks.set(entrance.name, dot);
  }
  return marks;
}

/** Marks which entrance the walks on screen are coming from. */
export function markActiveEntrance(
  marks: Map<string, L.CircleMarker>,
  active: string | null
): void {
  for (const [name, dot] of marks) {
    dot.setStyle(name === active ? ACTIVE_STYLE : DOT_STYLE);
    if (name === active) dot.bringToFront();
  }
}
