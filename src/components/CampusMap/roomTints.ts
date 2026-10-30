import L from 'leaflet';
import type { RoomTint } from '../../types/campusMap';
import { LABELS_PANE } from './mapPanes';

export interface RoomPoly {
  poly: L.Polygon;
  base: L.PathOptions;
  /** What the room looks like with no tint: kept so a tint can come and go. */
  plain: L.PathOptions;
}

/** A room that is not the point of the screen: still there, but quiet. */
const DIMMED: L.PathOptions = { opacity: 0.35, fillOpacity: 0.12, weight: 0.5 };

/**
 * Paints the tinted rooms of the open floor in place and names them for good.
 * With `dim`, every other room goes quiet and loses its name: a student who
 * came for six rooms should not have to read the other eighty.
 *
 * Restyles the live polygons rather than redrawing the floor: the heavy draw
 * effect also moves the camera, and a late answer (the library's free hours)
 * must not pull the map away from where the student has panned to.
 */
export function applyRoomTints(
  polys: Map<number, RoomPoly>,
  tints: Record<number, RoomTint>,
  selectedId: number | null,
  selectedStyle: L.PathOptions,
  dim = false
): void {
  for (const [id, entry] of polys) {
    const tint = tints[id];
    if (!tint) {
      const tip = entry.poly.getTooltip();
      if (dim) {
        entry.base = { ...entry.plain, ...DIMMED };
        entry.poly.closeTooltip();
      } else {
        entry.base = entry.plain;
        if (tip?.options.permanent) entry.poly.openTooltip();
      }
      entry.poly.setStyle(id === selectedId ? selectedStyle : entry.base);
      continue;
    }
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

/**
 * The box around the tinted rooms of one group (the library's two parts), or of
 * all of them when `group` is undefined or matches none. `null` when nothing is
 * tinted. Groups are the tints' own business: this knows only that they exist.
 */
export function tintedBoundsOf(
  polys: Map<number, RoomPoly>,
  tints: Record<number, RoomTint>,
  group?: string
): L.LatLngBounds | null {
  const pick = (g?: string) => {
    let box: L.LatLngBounds | null = null;
    for (const [id, { poly }] of polys) {
      const t = tints[id];
      if (!t || (g !== undefined && t.group !== g)) continue;
      const b = poly.getBounds();
      box = box ? box.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
    }
    return box;
  };
  return pick(group) ?? pick(undefined);
}
