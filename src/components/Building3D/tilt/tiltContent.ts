import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Vector3,
  type Group,
  type Scene,
} from 'three';
import { loadBuildingGroup, type BuildingGroupInput } from '../buildingGroup';
import type { Projector } from '../projection';
import { buildingOutlines } from './mapOverlays';
import { buildTileGround } from './tileGround';
import { glassShell, LOOK, roomFade } from './tiltLook';
import type { MapView } from './tiltCamera';

const PIN_ABOVE_ROOF = 16; // metres: the stem rises clear of the roofline, so the label never sits on the building

/** What the scene animates once it has loaded. */
export interface TiltContent {
  shell: Group | null;
  slab: Group | null;
  slabElevation: number;
  fade: ((k: number) => void) | null;
  stem: Line | null;
  /** The label pin's anchor, above the roof over the lit room. */
  pin: Vector3 | null;
}

/**
 * Fill the scene: the ground (near tiles at the map's zoom, a coarser ring for
 * the horizon), the other buildings' outlines, and the building as glass with
 * its lit room and pin. `ready` resolves once the frame can stand in for the
 * flat map — building built, the tiles in view arrived.
 */
export function addTiltContent(
  scene: Scene,
  input: BuildingGroupInput & { view: MapView },
  project: Projector,
  groundY: number,
  onTile: () => void
) {
  const { view, model } = input;
  const content: TiltContent = {
    shell: null,
    slab: null,
    slabElevation: 0,
    fade: null,
    stem: null,
    pin: null,
  };
  const near = buildTileGround({
    project,
    center: view.center,
    zoom: view.zoom,
    radius: 5,
    y: groundY,
    onTile,
  });
  const far = buildTileGround({
    project,
    center: view.center,
    zoom: view.zoom - 3,
    radius: 3,
    y: groundY - 0.4,
    onTile,
  });
  scene.add(near.group, far.group, buildingOutlines(project, groundY + 0.1, model.meta.buildingId));

  const building = loadBuildingGroup({ ...input, cutaway: false }).then((parts) => {
    content.shell = parts.shell;
    content.slab = parts.slab;
    content.slabElevation = parts.slabElevation;
    glassShell(parts.shell, input.targetLevel);
    scene.add(parts.shell);
    if (!parts.slab) return;
    scene.add(parts.slab);
    content.fade = roomFade(parts.slab, input.targetRoomId);
    // The pin rises from the lit room to clear the roof, so the label is never
    // behind the building it names.
    const room = parts.slab.children.find((c) => c.userData.roomId === input.targetRoomId);
    if (!room) return;
    const box = new Box3().setFromObject(room);
    const c = box.getCenter(new Vector3());
    const top = parts.slabElevation + (box.max.y - box.min.y) + 0.1;
    content.pin = new Vector3(c.x, model.meta.height + PIN_ABOVE_ROOF, c.z);
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute([c.x, top, c.z, c.x, content.pin.y, c.z], 3)
    );
    content.stem = new Line(g, new LineBasicMaterial({ color: LOOK.target, toneMapped: false }));
    scene.add(content.stem);
  });
  const ready = Promise.all([
    building,
    Promise.race([near.loaded, new Promise((r) => setTimeout(r, 4000))]),
  ]);
  return { content, ready };
}
