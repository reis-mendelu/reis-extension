import { LABELLED_ROOM_SPAN_M, planLabel, roomLabel } from '../../CampusMap/mapHelpers';
import type { Projector } from '../projection';
import type { RoomFeature } from '../../../types/campusMap';

/** A room's name on the tilted floor, in the model's local frame. */
export interface LabelAnchor {
  text: string;
  x: number;
  y: number;
  z: number;
}

/**
 * A polygon's area centroid (shoelace) — where Leaflet puts a polygon's
 * tooltip, so the tilted label sits where the flat one did. Null when degenerate.
 */
function centroid(pts: [number, number][]): [number, number] | null {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i]!;
    const [x1, z1] = pts[i + 1]!;
    const k = x0 * z1 - x1 * z0;
    a += k;
    cx += (x0 + x1) * k;
    cz += (z0 + z1) * k;
  }
  if (Math.abs(a) < 1e-9) return null;
  return [cx / (3 * a), cz / (3 * a)];
}

/**
 * The labels the tilted floor carries: the same rooms the flat plan labels
 * permanently (named, and big enough), by code alone, at their centre on the
 * floor. The lit room is left out; the pin names it.
 */
export function labelAnchors(
  rooms: RoomFeature[],
  project: Projector,
  elevation: number,
  targetRoomId: number | null
): LabelAnchor[] {
  const out: LabelAnchor[] = [];
  for (const room of rooms) {
    const p = room.properties;
    if (!p.name || p.id === targetRoomId || p.category === 'structure') continue;
    const ring = room.geometry.coordinates[0] ?? [];
    const pts = ring.map((c) => project(c));
    if (pts.length === 0) continue;
    const xs = pts.map(([x]) => x);
    const zs = pts.map(([, z]) => z);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    if (Math.hypot(x1 - x0, z1 - z0) <= LABELLED_ROOM_SPAN_M) continue;
    const [cx, cz] = centroid(pts) ?? [(x0 + x1) / 2, (z0 + z1) / 2];
    out.push({
      text: planLabel(roomLabel(p.name, p.passportNumber, p.nickname)),
      x: cx,
      y: elevation + 0.3,
      z: cz,
    });
  }
  return out;
}

/** A label's box on screen: centre and size, CSS pixels. */
export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 2;
const overlaps = (a: ScreenBox, b: ScreenBox) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w + GAP * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + GAP * 2;

/**
 * Which labels to show, in order: each one wholly inside the view and clear of
 * the pin (`blocked`) and of every label kept before it. Returns their indices.
 */
export function placeLabels(
  boxes: ScreenBox[],
  width: number,
  height: number,
  blocked: ScreenBox[]
): number[] {
  const kept: ScreenBox[] = [...blocked];
  const shown: number[] = [];
  boxes.forEach((b, i) => {
    const inside =
      b.x - b.w / 2 >= 0 && b.x + b.w / 2 <= width && b.y - b.h / 2 >= 0 && b.y + b.h / 2 <= height;
    if (!inside || kept.some((k) => overlaps(k, b))) return;
    kept.push(b);
    shown.push(i);
  });
  return shown;
}
