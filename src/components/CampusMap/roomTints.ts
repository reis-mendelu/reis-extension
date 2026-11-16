import L from 'leaflet';
import type { MapSelection, RoomTint } from '../../types/campusMap';
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
        // Leaflet's setStyle changes only the keys it is given: name the
        // opacity the dimming lowered, or the stroke stays faint.
        entry.base = { ...entry.plain, opacity: 1 };
        if (tip?.options.permanent) entry.poly.openTooltip();
      }
      entry.poly.setStyle(id === selectedId ? selectedStyle : entry.base);
      continue;
    }
    entry.base = tint.pending
      ? {
          ...entry.plain,
          color: '#64748b',
          fillColor: tint.fill,
          fillOpacity: 0.3,
          weight: 1.5,
          dashArray: '4 3',
        }
      : {
          ...entry.plain,
          color: tint.fill,
          fillColor: tint.fill,
          fillOpacity: 0.78,
          weight: 1.5,
          dashArray: undefined,
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

/** The box around the tinted rooms, or `null` when nothing is tinted. */
export function tintedBoundsOf(
  polys: Map<number, RoomPoly>,
  tints: Record<number, RoomTint>
): L.LatLngBounds | null {
  let box: L.LatLngBounds | null = null;
  for (const [id, { poly }] of polys) {
    if (!tints[id]) continue;
    const b = poly.getBounds();
    box = box ? box.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
  }
  return box;
}

export type RoomTap = 'claim' | 'ignore' | 'select';

/**
 * What a tap on a room of the plan does while a screen has tinted some of them
 * (the library's six, phone and iPad only — nothing else sets tints):
 *
 * - a tinted room is the screen's: `claim`, and the screen opens it;
 * - any other room, while the screen's own card is open, is `ignore`d. A stray
 *   tap on the Seminar Room used to close the library and show "Akce";
 * - otherwise an ordinary room `select`ion, as before.
 */
export function roomTapIntent(
  id: number,
  tints: Record<number, RoomTint>,
  screenOpen: boolean
): RoomTap {
  if (tints[id]) return 'claim';
  return screenOpen ? 'ignore' : 'select';
}

/** The room a selection points at on the open floor: a picked room, or a library room. */
export function selectedRoomId(sel: MapSelection | null): number | null {
  if (sel?.kind === 'roomRef') return sel.entry.placeId;
  if (sel?.kind === 'room') return sel.room.id;
  if (sel?.kind === 'library') return sel.featureId ?? null;
  return null;
}

export interface LabelBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Higher keeps its label first: the selected room, then bigger rooms. */
  rank: number;
}

/**
 * Which tinted rooms keep their name at the current zoom: greedily by rank, a
 * name is dropped when its box would touch one already kept. Framing all six
 * library rooms puts three small ones in 60 px, and their names stacked into one
 * unreadable smudge; the colour stays, and a room's name returns once the
 * camera closes in on it.
 */
export function keptLabels(boxes: readonly LabelBox[]): Set<number> {
  const kept: LabelBox[] = [];
  for (const b of [...boxes].sort((a, c) => c.rank - a.rank)) {
    const hits = kept.some(
      (k) => b.x < k.x + k.w && k.x < b.x + b.w && b.y < k.y + k.h && k.y < b.y + b.h
    );
    if (!hits) kept.push(b);
  }
  return new Set(kept.map((k) => k.id));
}

/** Shows or hides each tinted room's name by `keptLabels`, measured on screen. */
export function declutterTintLabels(
  polys: Map<number, RoomPoly>,
  tints: Record<number, RoomTint>,
  selectedId: number | null
): void {
  const boxes: LabelBox[] = [];
  const els = new Map<number, HTMLElement>();
  for (const [id, { poly }] of polys) {
    const el = tints[id] ? poly.getTooltip()?.getElement() : undefined;
    if (!el) continue;
    el.style.visibility = '';
    const r = el.getBoundingClientRect();
    const b = poly.getBounds();
    const area = Math.abs((b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest()));
    boxes.push({
      id,
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      rank: id === selectedId ? Infinity : area,
    });
    els.set(id, el);
  }
  const keep = keptLabels(boxes);
  for (const [id, el] of els) el.style.visibility = keep.has(id) ? '' : 'hidden';
}
