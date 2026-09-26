import { Mesh, type Group, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cutawayPlan } from './cutaway';
import { buildFloorSlab, type RoomLook, type SlabColors } from './floorSlabs';
import { makeProjector } from './projection';
import type { BuildingModel } from '../../types/buildingModel';
import type { RoomFeature } from '../../types/campusMap';

export interface BuildingGroupInput {
  model: BuildingModel;
  /** The target floor's rooms, already filtered. */
  rooms: RoomFeature[];
  targetLevel: number | null;
  targetRoomId: number | null;
  colors: SlabColors;
  lookOf?: (room: RoomFeature, isTarget: boolean) => RoomLook;
  /** Lift the storeys above the target (the card). The tilted map's glass needs no lid. */
  cutaway?: boolean;
}

/** Everything a storey node needs to look like its role in the cutaway. */
function applyCutaway(root: Object3D, input: BuildingGroupInput) {
  const plan = cutawayPlan(input.model.meta.storeys, input.targetLevel);
  for (const node of root.children) {
    const step = plan.find((p) => p.level === node.userData.level);
    if (!step) continue;
    node.position.y = step.offsetY;
    if (step.opacity === 1) continue;
    node.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const floor = (o.material as Material).name === 'floor';
      // Inside the lid, the floor slabs are six stacked sheets seen from above:
      // they turn a basement into milk. The walls and roofs alone read as a lid.
      if (step.role === 'lifted' && floor) return void (o.visible = false);
      const material = (o.material as Material).clone();
      // The target storey keeps its floor solid: it is what the rooms stand on.
      if (step.role === 'target' && floor) return void (o.material = material);
      material.transparent = true;
      material.opacity = step.opacity;
      material.depthWrite = false;
      o.material = material;
    });
  }
}

/**
 * The building as the scene shows it: the model cut open at the target floor,
 * and that floor's rooms, in the model's local frame (origin = anchor, y =
 * metres above the base). Shared by the building card and the tilted map.
 */
export async function loadBuildingGroup(input: BuildingGroupInput): Promise<BuildingParts> {
  const { meta } = input.model;
  const gltf = await new GLTFLoader().parseAsync(input.model.glb, '');
  if (input.cutaway !== false) applyCutaway(gltf.scene, input);
  const target = meta.storeys.find((s) => s.level === input.targetLevel);
  const slab =
    target && input.rooms.length > 0
      ? buildFloorSlab({
          rooms: input.rooms,
          project: makeProjector(meta.anchor),
          elevation: target.elevation,
          storeyHeight: target.height,
          targetRoomId: input.targetRoomId,
          colors: input.colors,
          lookOf: input.lookOf,
        })
      : null;
  return { shell: gltf.scene, slab, slabElevation: target?.elevation ?? 0 };
}

/** The shell and the target floor's rooms, apart: the tilted map moves them differently. */
export interface BuildingParts {
  shell: Group;
  slab: Group | null;
  slabElevation: number;
}
