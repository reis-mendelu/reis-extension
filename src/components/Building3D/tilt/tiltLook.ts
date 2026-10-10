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
import { cutawayPlan, type StoreyRole } from '../cutaway';
import type { BuildingModelStorey } from '../../../types/buildingModel';

/**
 * The tilted map's look: Q cut open at the room's storey. Everything above it is
 * removed — ghosted storeys in front of a room weaken the depth cues and turn the
 * view into a cage of lines, and no indoor map or BIM viewer draws them — the
 * room's storey is glass on a solid floor, everything below one plain solid, so
 * the building's height says which floor it is. Orange belongs to the room alone.
 * The room colour is orange-700 rather than the flat map's orange-600: 600 is
 * 2.9:1 against the light basemap, 700 is 4.2:1 — the room must read at a glance.
 */
export const LOOK = {
  glass: '#ffffff',
  glassOpacity: 0.2,
  roofOpacity: 0.34,
  edge: '#1e293b',
  /** Corner lines of the room's storey: its shape, too faint to form a cage. */
  edgeOpacity: 0.22,
  /** The storeys below the room: one plain solid, slate-200. */
  below: '#e2e8f0',
  /** The room's floor, a solid plate: the rooms sit on white, not on grey. */
  plate: '#f8fafc',
  plateOpacity: 0.94,
  target: '#c2410c',
  /** The route's staircase — the map's route colour (--color-route, fuchsia-700). */
  route: '#a21caf',
  /** The block's sides, a step darker (orange-800): the unlit block read flat. */
  targetSide: '#9a3412',
  /** A white halo, not a darker edge: the block sits among dark room outlines
   *  and light floor, and no one colour clears 3:1 against both — a light rim
   *  separates it from every neighbour. */
  targetEdge: '#ffffff',
} as const;

const ROOFS = new Set(['gravel', 'silver', 'glassRoof']);

/** Keep an edge set's vertical segments. */
function verticalEdges(geometry: BufferGeometry): BufferGeometry {
  const all = new EdgesGeometry(geometry, 25).getAttribute('position');
  const out: number[] = [];
  for (let i = 0; i < all.count; i += 2) {
    if (Math.abs(all.getY(i) - all.getY(i + 1)) <= 0.01) continue;
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

/** Cut the modelled building open at `targetLevel` (see LOOK). */
export function cutShell(
  root: Object3D,
  targetLevel: number | null,
  storeys: BuildingModelStorey[]
) {
  const roles = new Map<number, StoreyRole>(
    cutawayPlan(storeys, targetLevel).map((p) => [p.level, p.role])
  );
  const glass = (opacity: number) =>
    new MeshBasicMaterial({
      color: LOOK.glass,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
  const wall = glass(LOOK.glassOpacity);
  const roof = glass(LOOK.roofOpacity);
  const plate = new MeshBasicMaterial({
    color: LOOK.plate,
    transparent: true,
    opacity: LOOK.plateOpacity,
    depthWrite: false,
    toneMapped: false,
  });
  const below = new MeshBasicMaterial({ color: LOOK.below, toneMapped: false });
  const edge = fatMaterial(LOOK.edge, 1, LOOK.edgeOpacity);
  const meshes: Mesh[] = [];
  root.traverse((o) => o instanceof Mesh && meshes.push(o));
  for (const mesh of meshes) {
    const name = (mesh.material as Material).name;
    const level = levelOf(mesh);
    // No floor known: the whole building as glass, its floors hidden — a solid
    // block would say nothing, and every floor as a plate stacks into milk.
    if (targetLevel === null && name === 'floor') {
      mesh.visible = false;
      continue;
    }
    const role =
      targetLevel === null
        ? 'target'
        : level === undefined
          ? 'below'
          : (roles.get(level) ?? 'below');
    if (role === 'lifted') {
      mesh.visible = false;
      continue;
    }
    // Windows and slab bands are detail that competes with the room.
    if (name === 'window' || name === 'slab') {
      mesh.visible = false;
      continue;
    }
    if (role === 'below') {
      mesh.material = below;
      continue;
    }
    if (name === 'floor') {
      mesh.material = plate;
      continue;
    }
    const isRoof = ROOFS.has(name);
    mesh.material = isRoof ? roof : wall;
    if (!isRoof) mesh.add(fatSegments(verticalEdges(mesh.geometry), edge));
  }
}
