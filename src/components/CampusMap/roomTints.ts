import L from 'leaflet';
import type { RoomTint } from '../../types/campusMap';
import { LABELS_PANE } from './mapPanes';

export interface RoomPoly {
  poly: L.Polygon;
  base: L.PathOptions;
  /** What the room looks like with no tint: kept so a tint can come and go. */
  plain: L.PathOptions;
}

/**
 * Paints the tinted rooms of the open floor in place and names them for good.
 *
 * Restyles the live polygons rather than redrawing the floor: the heavy draw
 * effect also moves the camera, and a late answer (the library's free hours)
 * must not pull the map away from where the student has panned to.
 */
export function applyRoomTints(
  polys: Map<number, RoomPoly>,
  tints: Record<number, RoomTint>,
  selectedId: number | null,
  selectedStyle: L.PathOptions
): void {
  for (const [id, entry] of polys) {
    const tint = tints[id];
    if (!tint) continue;
    entry.base = {
      ...entry.plain,
      color: tint.fill,
      fillColor: tint.fill,
      fillOpacity: 0.78,
      weight: 1.5,
    };
    entry.poly.setStyle(id === selectedId ? selectedStyle : entry.base);
    entry.poly.unbindTooltip();
    entry.poly.bindTooltip(tint.label, {
      permanent: true,
      direction: 'center',
      className: 'room-label',
      pane: LABELS_PANE,
    });
  }
}
