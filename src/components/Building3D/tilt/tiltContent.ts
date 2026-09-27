import {
  Mesh,
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  type Group,
  type Object3D,
  type Scene,
} from 'three';
import { fatMaterial, fatSegments } from './fatLines';
import { loadBuildingGroup, type BuildingGroupInput } from '../buildingGroup';
import type { Projector } from '../projection';
import { buildingOutlines } from './mapOverlays';
import { buildTileGround } from './tileGround';
import { glassShell, LOOK } from './tiltLook';
import { roomFade } from './roomFade';
import type { MapView } from './tiltCamera';

const PIN_ABOVE_ROOF = 16; // metres: the stem rises clear of the roofline, so the label never sits on the building

/** What the scene animates once it has loaded. */
export interface TiltContent {
  shell: Group | null;
  slab: Group | null;
  slabElevation: number;
  fade: ((k: number) => void) | null;
  stem: Object3D | null;
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

  const building = loadBuildingGroup({
    ...input,
    cutaway: false,
    // Leaflet strokes rooms 1 px wide; the lit room's halo is wider.
    makeEdges: (edges, color, opacity, isTarget) =>
      fatSegments(edges, fatMaterial(color, isTarget ? 6 : 1, opacity)),
  }).then((parts) => {
    content.shell = parts.shell;
    content.slab = parts.slab;
    content.slabElevation = parts.slabElevation;
    glassShell(parts.shell, input.targetLevel);
    scene.add(parts.shell);
    if (!parts.slab) return;
    scene.add(parts.slab);
    content.fade = roomFade(parts.slab, input.targetRoomId);
    // The lit room draws after the glass: three.js draws opaque things first, so
    // as an opaque block it sat UNDER every translucent storey above it and came
    // out washed pale. Last in the transparent pass, at full opacity, it stays
    // its own colour; its halo draws after it, the stem last.
    parts.slab.traverse((o) => {
      if (o.userData.roomId !== input.targetRoomId) return;
      // Halo first, then the block, both over everything: nothing may cut across
      // the lit room (the rooflines above it did). The block covers every halo
      // line inside its own silhouette, so what survives is a white rim around
      // its outline — and its sides stay visible. Convex and back-face culled, the
      // block shows only its front without a depth test.
      // (LineSegments2 is itself a Mesh — tell the halo apart by its flag.)
      const isLine = (o as { isLineSegments2?: boolean }).isLineSegments2 === true;
      o.renderOrder = isLine ? 9 : 10;
      const mats = (o as unknown as { material: { depthTest: boolean } | { depthTest: boolean }[] })
        .material;
      for (const m of Array.isArray(mats) ? mats : [mats]) m.depthTest = false;
    });
    // The pin rises from the lit room to clear the roof, so the label is never
    // behind the building it names.
    const room = parts.slab.children.find((c) => c.userData.roomId === input.targetRoomId);
    if (!room) return;
    // Measured in the slab's own frame, not the world's: at load the rooms still
    // lie flat on the ground, 14 m below their floor, and a world-space box put
    // the stem's foot there — it showed through the floor plan as a pale dash.
    const mesh = room as Mesh;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!.clone().translate(mesh.position);
    const c = box.getCenter(new Vector3());
    const top = box.max.y + 0.15;
    content.pin = new Vector3(c.x, model.meta.height + PIN_ABOVE_ROOF, c.z);
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute([c.x, top, c.z, c.x, content.pin.y, c.z], 3)
    );
    const stemMaterial = fatMaterial(LOOK.target, 2);
    // Drawn last, on top: as an opaque line it went into three.js's opaque pass,
    // BEFORE the glass, and every storey it rises through washed it pale — all
    // but one stretch, which read as a stray dash on the room.
    stemMaterial.transparent = true;
    stemMaterial.depthTest = false;
    content.stem = fatSegments(g, stemMaterial);
    content.stem.renderOrder = 12;
    scene.add(content.stem);
  });
  const ready = Promise.all([
    building,
    Promise.race([near.loaded, new Promise((r) => setTimeout(r, 4000))]),
  ]);
  return { content, ready };
}
