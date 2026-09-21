import L from 'leaflet';

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
