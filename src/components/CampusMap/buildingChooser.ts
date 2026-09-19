import L from 'leaflet';
import buildingsJson from '../../data/map/buildings.json';
import type { BuildingsMeta } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;

/**
 * "Now pick where you are going."
 *
 * Shown only once a gate has been chosen. A walk is two questions — where did
 * you come in, and where are you headed — and answering both at once by lighting
 * up all seven walks put seven times on the map and made the student read the
 * whole campus to find their own. Asking the second question explicitly means
 * one walk, one number, no reading.
 *
 * The pills sit on the building centres, on top of the letters those buildings
 * already draw, so the thing you pick is the thing you are looking at. They are
 * their own markers rather than the building polygons because tapping a
 * building polygon drills into its floor plan, and that behaviour is not up for
 * grabs here.
 */
export function drawBuildingChooser(
  layer: L.LayerGroup,
  onPick: (building: string) => void,
  chosen: string | null
): Map<string, L.Marker> {
  const marks = new Map<string, L.Marker>();
  for (const b of META.buildings) {
    const active = b.name === chosen;
    const icon = L.divIcon({
      className: '',
      html: `<span class="reis-pick${active ? ' reis-pick-on' : ''}">${b.name}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const mark = L.marker([b.center[0], b.center[1]], {
      icon,
      keyboard: false,
      // Above the trail and the walk, so the thing you are asked to tap is never
      // underneath the thing it draws.
      zIndexOffset: 1000,
    })
      .on('click', (e) => {
        // Without this the tap also reaches the map, which clears the gate the
        // student picked a moment ago.
        L.DomEvent.stopPropagation(e);
        onPick(b.name);
      })
      .addTo(layer);
    marks.set(b.name, mark);
  }
  return marks;
}
