import {
  Color,
  Mesh,
  MeshBasicMaterial,
  type BufferGeometry,
  type Group,
  type Object3D,
} from 'three';
import { LineMaterial } from './fatLines';
import { LOOK } from './tiltLook';

interface Fade {
  material: MeshBasicMaterial | LineMaterial;
  from: { color: Color; opacity: number };
  to: { color: Color; opacity: number };
}

/**
 * The floor's rooms start in the flat map's colours (so the handover frame is
 * the flat map) and fade into the tilted look as the building rises: every room
 * to a quiet outline, the target to the solid room colour.
 */
/** Horizontal extent of an object's geometry, in its parent's frame. */
function boxXZ(o: Object3D): { x0: number; x1: number; z0: number; z1: number } | null {
  const g = (o as { geometry?: BufferGeometry }).geometry;
  if (!g) return null;
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox;
  if (!b) return null;
  const [dx, dz] = [o.position.x, o.position.z];
  return { x0: b.min.x + dx, x1: b.max.x + dx, z0: b.min.z + dz, z1: b.max.z + dz };
}

/**
 * How much of a neighbour to draw, by the gap between the two rooms (edge to
 * edge — a 20 m lecture hall's neighbours touch it): fully within `SPOT_NEAR`
 * metres of the lit room, fading to nothing by `SPOT_FAR`. The whole floor was too many rooms to
 * read; the eye places a room by its immediate neighbours, and the glass shell
 * already gives the building's shape.
 */
export const SPOT_NEAR = 6;
export const SPOT_FAR = 22;
export function spotlight(distance: number): number {
  if (distance <= SPOT_NEAR) return 1;
  if (distance >= SPOT_FAR) return 0;
  return 1 - (distance - SPOT_NEAR) / (SPOT_FAR - SPOT_NEAR);
}

export function roomFade(slab: Group, targetRoomId: number | null) {
  const fades: Fade[] = [];
  const target = slab.children.find((c) => c.userData.roomId === targetRoomId && c instanceof Mesh);
  void boxXZ;
  void target;
  // MOCK: the spotlight is off — the whole floor stays.
  void spotlight;
  slab.traverse((o) => {
    const isTarget = o.userData.roomId === targetRoomId;
    if (o instanceof Mesh && Array.isArray(o.material)) {
      (o.material as MeshBasicMaterial[]).forEach((m, i) => {
        m.depthWrite = true;
        fades.push({
          material: m,
          from: { color: m.color.clone(), opacity: m.opacity },
          to: { color: new Color(i === 0 ? LOOK.target : LOOK.targetSide), opacity: 1 },
        });
      });
    } else if (o instanceof Mesh && o.material instanceof MeshBasicMaterial) {
      const m = o.material;
      m.depthWrite = isTarget;
      // MOCK (cut above): the floor keeps the flat map's colours, whole — the
      // plan the student just saw — and only the target turns orange.
      const from = { color: m.color.clone(), opacity: m.opacity };
      fades.push({
        material: m,
        from,
        to: isTarget
          ? { color: new Color(LOOK.target), opacity: 1 }
          : { color: from.color, opacity: Math.max(from.opacity, 0.85) },
      });
    } else if ((o as { material?: unknown }).material instanceof LineMaterial) {
      const m = (o as unknown as { material: LineMaterial }).material;
      m.transparent = true;
      fades.push({
        material: m,
        from: { color: m.color.clone(), opacity: m.opacity },
        to: isTarget
          ? { color: new Color(LOOK.targetEdge), opacity: 1 }
          : { color: m.color.clone(), opacity: m.opacity },
      });
    }
  });
  return (k: number) => {
    for (const f of fades) {
      f.material.color.copy(f.from.color).lerp(f.to.color, k);
      f.material.opacity = f.from.opacity + (f.to.opacity - f.from.opacity) * k;
    }
  };
}
