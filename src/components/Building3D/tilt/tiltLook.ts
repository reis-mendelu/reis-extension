import {
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  type Group,
  type Material,
  type Object3D,
} from 'three';

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
  edgeOpacity: 0.3,
  /** The target storey's ring, in the room's colour. */
  ringOpacity: 0.85,
  /** The roofline carries the building's outline. */
  roofEdgeOpacity: 0.6,
  room: '#ffffff',
  roomOpacity: 0.22,
  roomEdge: '#94a3b8',
  /** The floor's other rooms: there if you look, never first. */
  roomEdgeOpacity: 0.4,
  target: '#c2410c',
  targetEdge: '#7c2d12',
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
  const edge = new LineBasicMaterial({
    color: LOOK.edge,
    transparent: true,
    opacity: LOOK.edgeOpacity,
    toneMapped: false,
  });
  const roofEdge = edge.clone();
  roofEdge.opacity = LOOK.roofEdgeOpacity;
  const ring = new LineBasicMaterial({
    color: LOOK.target,
    transparent: true,
    opacity: LOOK.ringOpacity,
    toneMapped: false,
  });
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
      mesh.add(new LineSegments(new EdgesGeometry(mesh.geometry, 25), roofEdge));
      continue;
    }
    // Storey lines on every face, front and back through the glass, made a cage;
    // only the corners stay, plus the target storey's ring.
    mesh.add(new LineSegments(edgesWhere(mesh.geometry, 'vertical'), edge));
    if (targetLevel !== null && levelOf(mesh) === targetLevel)
      mesh.add(new LineSegments(edgesWhere(mesh.geometry, 'horizontal'), ring));
  }
}

interface Fade {
  material: MeshBasicMaterial | LineBasicMaterial;
  from: { color: Color; opacity: number };
  to: { color: Color; opacity: number };
}

/**
 * The floor's rooms start in the flat map's colours (so the handover frame is
 * the flat map) and fade into the tilted look as the building rises: every room
 * to a quiet outline, the target to the solid room colour.
 */
export function roomFade(slab: Group, targetRoomId: number | null) {
  const fades: Fade[] = [];
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
          opacity: isTarget ? 1 : LOOK.roomOpacity,
        },
      });
    } else if (o instanceof LineSegments && o.material instanceof LineBasicMaterial) {
      const m = o.material;
      fades.push({
        material: m,
        from: { color: m.color.clone(), opacity: m.opacity },
        to: {
          color: new Color(isTarget ? LOOK.targetEdge : LOOK.roomEdge),
          opacity: isTarget ? 1 : LOOK.roomEdgeOpacity,
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
