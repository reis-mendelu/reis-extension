import {
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type Group,
  type Material,
  type Object3D,
} from 'three';
import { fatMaterial, fatSegments, LineMaterial } from './fatLines';

/**
 * The tilted map's look: Q as glass with crisp edges, its target floor as quiet
 * outlines, and one room that is not quiet at all. The room colour is orange-700
 * rather than the flat map's orange-600: 600 is 2.9:1 against the light
 * basemap, 700 is 4.2:1 — the room must read at a glance.
 */
export const LOOK = {
  glass: '#ffffff',
  glassOpacity: 0.2,
  roofOpacity: 0.34,
  edge: '#1e293b',
  /** Corner lines: the building's shape, too faint to form a cage. */
  edgeOpacity: 0.22,
  /** The target storey's ring, in the room's colour. */
  ringOpacity: 0.7,
  /** The roofline carries the building's outline. */
  roofEdgeOpacity: 0.45,
  /** The floor's other rooms: a clear light plan to place the lit room against —
   *  readable, but uncoloured, so the room is still the only colour on it. */
  room: '#f8fafc',
  roomOpacity: 0.88,
  roomEdge: '#475569',
  roomEdgeOpacity: 0.75,
  target: '#c2410c',
  /** A white halo, not a darker edge: the block sits among dark room outlines
   *  and light floor, and no one colour clears 3:1 against both — a light rim
   *  separates it from every neighbour. */
  targetEdge: '#ffffff',
} as const;

const HIDDEN = new Set(['window', 'slab', 'floor']);
const ROOFS = new Set(['gravel', 'silver', 'glassRoof']);

/** Keep an edge set's vertical segments, or its horizontal ones. */
function edgesWhere(geometry: BufferGeometry, keep: 'vertical' | 'horizontal'): BufferGeometry {
  const all = new EdgesGeometry(geometry, 25).getAttribute('position');
  const out: number[] = [];
  for (let i = 0; i < all.count; i += 2) {
    const vertical = Math.abs(all.getY(i) - all.getY(i + 1)) > 0.01;
    if (vertical === (keep === 'vertical'))
      out.push(
        all.getX(i),
        all.getY(i),
        all.getZ(i),
        all.getX(i + 1),
        all.getY(i + 1),
        all.getZ(i + 1)
      );
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(out, 3));
  return g;
}

const levelOf = (o: Object3D): number | undefined => {
  for (let p: Object3D | null = o; p; p = p.parent)
    if (p.userData.level !== undefined) return p.userData.level;
  return undefined;
};

/**
 * Turn the modelled facades into glass: one translucent skin, its corners and
 * roofline drawn — and the target storey ringed in the room's colour, so the
 * floor reads from the outside before the room does.
 */
export function glassShell(root: Object3D, targetLevel: number | null) {
  const wall = new MeshBasicMaterial({
    color: LOOK.glass,
    transparent: true,
    opacity: LOOK.glassOpacity,
    depthWrite: false,
    toneMapped: false,
  });
  const roof = wall.clone();
  roof.opacity = LOOK.roofOpacity;
  const edge = fatMaterial(LOOK.edge, 1, LOOK.edgeOpacity);
  const roofEdge = fatMaterial(LOOK.edge, 1.25, LOOK.roofEdgeOpacity);
  const ring = fatMaterial(LOOK.target, 1.5, LOOK.ringOpacity);
  const meshes: Mesh[] = [];
  root.traverse((o) => o instanceof Mesh && meshes.push(o));
  for (const mesh of meshes) {
    const name = (mesh.material as Material).name;
    // Windows and slab bands are detail that competes with the room; floor caps
    // stack into milk. Storey lines come from the wall edges instead.
    if (HIDDEN.has(name)) {
      mesh.visible = false;
      continue;
    }
    const isRoof = ROOFS.has(name);
    mesh.material = isRoof ? roof : wall;
    if (isRoof) {
      mesh.add(fatSegments(new EdgesGeometry(mesh.geometry, 25), roofEdge));
      continue;
    }
    // Storey lines on every face, front and back through the glass, made a cage;
    // only the corners stay, plus the target storey's ring.
    mesh.add(fatSegments(edgesWhere(mesh.geometry, 'vertical'), edge));
    if (targetLevel !== null && levelOf(mesh) === targetLevel)
      mesh.add(fatSegments(edgesWhere(mesh.geometry, 'horizontal'), ring));
  }
}

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
  const t = target ? boxXZ(target) : null;
  const weight = (o: Object3D) => {
    const b = t && boxXZ(o);
    if (!b || !t) return 1;
    const gx = Math.max(0, b.x0 - t.x1, t.x0 - b.x1);
    const gz = Math.max(0, b.z0 - t.z1, t.z0 - b.z1);
    return spotlight(Math.hypot(gx, gz));
  };
  slab.traverse((o) => {
    const isTarget = o.userData.roomId === targetRoomId;
    if (o instanceof Mesh && o.material instanceof MeshBasicMaterial) {
      const m = o.material;
      m.depthWrite = isTarget;
      fades.push({
        material: m,
        from: { color: m.color.clone(), opacity: m.opacity },
        to: {
          color: new Color(isTarget ? LOOK.target : LOOK.room),
          opacity: isTarget ? 1 : LOOK.roomOpacity * weight(o),
        },
      });
    } else if ((o as { material?: unknown }).material instanceof LineMaterial) {
      const m = (o as unknown as { material: LineMaterial }).material;
      m.transparent = true;
      fades.push({
        material: m,
        from: { color: m.color.clone(), opacity: m.opacity },
        to: {
          color: new Color(isTarget ? LOOK.targetEdge : LOOK.roomEdge),
          opacity: isTarget ? 1 : LOOK.roomEdgeOpacity * weight(o),
        },
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
