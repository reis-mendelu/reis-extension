import {
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type Material,
  type Object3D,
} from 'three';
import { fatMaterial, fatSegments } from './fatLines';

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
  plate: '#f8fafc',
  plateOpacity: 0.94,
  target: '#c2410c',
  /** The block's sides, a step darker (orange-800): the unlit block read flat. */
  targetSide: '#9a3412',
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
  // The target storey's floor is a solid light plate: the room sits on white
  // instead of the basemap's grey footprint seen through glass, and the plate
  // traces the whole floor at its height — the floor reads before the room does.
  const plate = new MeshBasicMaterial({
    color: LOOK.plate,
    transparent: true,
    opacity: LOOK.plateOpacity,
    depthWrite: false,
    toneMapped: false,
  });
  const meshes: Mesh[] = [];
  root.traverse((o) => o instanceof Mesh && meshes.push(o));
  for (const mesh of meshes) {
    const name = (mesh.material as Material).name;
    if (name === 'floor' && targetLevel !== null && levelOf(mesh) === targetLevel) {
      mesh.material = plate;
      continue;
    }
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
