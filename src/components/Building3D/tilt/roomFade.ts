import { Color, Mesh, MeshBasicMaterial, type Group } from 'three';
import { LineMaterial } from './fatLines';
import { LOOK } from './tiltLook';

interface Fade {
  material: MeshBasicMaterial | LineMaterial;
  from: { color: Color; opacity: number };
  to: { color: Color; opacity: number };
}

/**
 * The floor's rooms start in the flat map's colours (so the handover frame is
 * the flat map) and keep them: the tilted floor is the plan the student just
 * saw, whole — a room is placed by its neighbours, and whitening them or fading
 * the far ones threw that away. Only the target fades, into the solid room
 * colour — and the route's staircase, if any, into the route colour.
 */
export function roomFade(slab: Group, targetRoomId: number | null, routeRoomIds: number[] = []) {
  const fades: Fade[] = [];
  slab.traverse((o) => {
    // The route's staircase on this floor fades into the route colour.
    const id = o.userData.roomId as number | undefined;
    if (id !== undefined && id !== targetRoomId && routeRoomIds.includes(id)) {
      if (o instanceof Mesh && o.material instanceof MeshBasicMaterial) {
        // Coplanar with its neighbours, like every other fill: no depth writes.
        o.material.depthWrite = false;
        fades.push({
          material: o.material,
          from: { color: o.material.color.clone(), opacity: o.material.opacity },
          to: { color: new Color(LOOK.route), opacity: 1 },
        });
      }
      return;
    }
    if (o.userData.roomId !== targetRoomId) {
      // Translucent, coplanar fills: kept out of the depth buffer, or whichever
      // draws first hides the part of its neighbour it overlaps.
      if (o instanceof Mesh && o.material instanceof MeshBasicMaterial)
        o.material.depthWrite = false;
      return;
    }
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
      m.depthWrite = true;
      fades.push({
        material: m,
        from: { color: m.color.clone(), opacity: m.opacity },
        to: { color: new Color(LOOK.target), opacity: 1 },
      });
    } else if ((o as { material?: unknown }).material instanceof LineMaterial) {
      const m = (o as unknown as { material: LineMaterial }).material;
      m.transparent = true;
      fades.push({
        material: m,
        from: { color: m.color.clone(), opacity: m.opacity },
        to: { color: new Color(LOOK.targetEdge), opacity: 1 },
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
