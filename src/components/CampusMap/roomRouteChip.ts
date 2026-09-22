import L from 'leaflet';
import type { RouteStatus } from '../../store/slices/createRouteSlice';
import type { RouteTarget } from '../../utils/routing/nextLessonTarget';
import { tooltipShift } from '../../utils/tooltipShift';

/** Clear air between the pill's bottom edge and the room's outline. The pill
 *  is ~27px tall, so this lifts it just off the polygon it points at. */
const LIFT_PX = 34;

/**
 * "Najdi cestu", pinned to the room the student just tapped.
 *
 * The route control already exists in the sheet, and it stays: with nothing
 * selected it is the only way to ask. This one is the same action asked in the
 * place the question arises — you tap Q01 on the floor plan, and the answer to
 * "how do I get there" is offered at Q01 rather than at the bottom of the
 * screen, where it reads as a property of the map instead of the room.
 *
 * A MARKER with a divIcon, like the garden's bubbles, not a tooltip. Leaflet
 * renders a divIcon as `leaflet-marker-icon <class>` and a tooltip as
 * `leaflet-tooltip <class>`, and this project has already shipped one chip
 * styled against the wrong one of those: it went out transparent, inheriting
 * base-content on a basemap that is always light, and the test passed because
 * it asserted the html rather than whether anyone could see it. The rule for
 * this file's CSS is in index.css, on `.leaflet-marker-icon.room-route-chip`.
 *
 * Dark surface, because everything that floats over this basemap either brings
 * its own or disappears — the search pill above it does exactly the same, and
 * the brand green was tried on this map and read as a ghost. The glyph carries
 * the route's fuchsia so the control looks like the line it is about to draw;
 * the SOLID fuchsia stays reserved for the "9 min" chip, which is the answer
 * rather than the offer.
 */
export function drawRoomRouteChip(
  layer: L.LayerGroup,
  room: L.Polygon | null,
  label: string,
  onPress: () => void
): void {
  layer.clearLayers();
  if (!room) return;

  // Anchored to the room's NORTHERN edge, not its centre. The room's own name
  // is drawn dead centre, and a pill over the centre hid it — "now it's not
  // clear what the underlying room's name is". From the top edge the pill
  // points at the room instead of labelling it, and the name stays readable.
  const bounds = room.getBounds();
  const marker = L.marker(L.latLng(bounds.getNorth(), bounds.getCenter().lng), {
    // A press must not also reach the map, whose tap-away clears the very
    // selection this chip belongs to — the same trap the garden bubbles
    // document, and it would close the room in the gesture that asked for it.
    bubblingMouseEvents: false,
    icon: L.divIcon({
      className: 'room-route-chip',
      html: `<span class="room-route-chip-pill"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>${label}</span>`,
      // Width 0 with the pill centred on it: the label's length is not known
      // here, and a fixed width either clips "Najdi cestu" or pads the pill
      // with dead space the shadow then draws around.
      iconSize: [0, 0],
      iconAnchor: [0, LIFT_PX],
    }),
  });
  marker.on('click', onPress);
  // Leaflet gives a divIcon marker role="button" and a tabindex, so it takes
  // focus — but a div fires no click on Enter or Space, which would leave it
  // reachable by keyboard and inert once reached.
  marker.on('add', () => {
    marker.getElement()?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onPress();
    });
  });
  marker.addTo(layer);
}

/**
 * Whether the offer belongs on screen at all.
 *
 * Three rules, all learned on the device. It appears only for a lesson — the
 * suggestion is set by the pin beside a timetable row and by nothing else, so
 * a student reading the floor plan is not asked whether they want directions
 * to every room they tap. And it goes away the moment the walk exists: the
 * pill and the "12 min" chip both land at the destination and were drawn on
 * top of each other at 320, 390 and 430. Once the line is there the question
 * has been answered.
 *
 * And it is not offered where no walk could be built from — across the city,
 * or in a park with no mapped path within the snap tolerance. The press would
 * draw nothing, and with the sentences gone that is indistinguishable from a
 * broken button. `canRoute` defaults true where nothing is known; see
 * `canRouteFrom`.
 */
export function chipShown(
  suggestion: RouteTarget | null,
  status: RouteStatus,
  canRoute: boolean
): boolean {
  return !!suggestion && status === 'idle' && canRoute;
}

/**
 * How far sideways the pill has to move to stay on the usable map.
 *
 * Leaflet anchors it on the room and does not care whether the result is still
 * inside anything, so a room near the edge pushes its pill off — and the RAIL
 * makes that worse, because it overlays the right of the canvas rather than
 * sitting beside it. Measured in phone landscape (844x390): the rail was on
 * screen and the pill was drawn on top of it, the offer apparently floating
 * over the panel.
 *
 * `tooltipShift` already decided this arithmetic for the walk labels, including
 * what to do when the thing is wider than the space. It was left without a
 * caller when the gate fan went; this is the same question, so it gets its
 * caller back rather than a second copy of the rule.
 */
export function chipShiftPx(
  left: number,
  width: number,
  containerWidth: number,
  railPx: number
): number {
  return tooltipShift(left, width, containerWidth - railPx);
}

/**
 * Nudges the pill back onto the usable map, and keeps doing it.
 *
 * Called on every camera settle, not once: the student can pan or zoom the
 * room towards the edge after the pill is placed, and the rail can be dragged
 * wider underneath it.
 */
export function clampRoomChip(layer: L.LayerGroup, map: L.Map, railPx: number): void {
  for (const marker of layer.getLayers()) {
    const el = (marker as L.Marker)
      .getElement()
      ?.querySelector<HTMLElement>('.room-route-chip-pill');
    if (!el) continue;
    el.style.marginLeft = '0px';
    const box = el.getBoundingClientRect();
    const host = map.getContainer().getBoundingClientRect();
    const shift = chipShiftPx(box.left - host.left, box.width, host.width, railPx);
    if (shift) el.style.marginLeft = `${shift}px`;
  }
}
