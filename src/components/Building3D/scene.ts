import {
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cutawayPlan, LIFT_M } from './cutaway';
import { buildFloorSlab, type SlabColors } from './floorSlabs';
import { makeProjector } from './projection';
import { attachOrbit, type View } from './orbit';
import type { BuildingModel } from '../../types/buildingModel';
import type { RoomFeature } from '../../types/campusMap';

export interface SceneInput {
  model: BuildingModel;
  /** The target floor's rooms, already filtered. */
  rooms: RoomFeature[];
  targetLevel: number | null;
  targetRoomId: number | null;
  colors: SlabColors & { ground: string };
  /** The model could not be parsed: the card falls back to the flat plan. */
  onFailure?: (err: Error) => void;
}

export interface BuildingScene {
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

const FOV = 30;
const HOME_PITCH = 40;

/** Everything a storey node needs to look like its role in the cutaway. */
function applyCutaway(root: Object3D, input: SceneInput) {
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

function groundMesh(input: SceneInput): Mesh {
  const { ground, radius, storeys } = input.model.meta;
  const geometry = new CircleGeometry(radius * 10, 64);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position!;
  for (let i = 0; i < pos.count; i++)
    pos.setY(i, ground.a + ground.b * pos.getX(i) + ground.c * pos.getZ(i) - 0.05);
  geometry.computeVertexNormals();
  // A floor the ground rises above ANYWHERE under the building has to be seen
  // through it. Q's ground falls ~10 m to the west, so floor −1 opens onto the
  // west side and is buried on the east; judged at the centre alone, the sloped
  // ground sliced the floor's rooms in two.
  const target = storeys.find((s) => s.level === input.targetLevel);
  const highestGround = ground.a + (Math.abs(ground.b) + Math.abs(ground.c)) * radius;
  const buried = !!target && target.elevation < highestGround;
  const opacity = buried ? 0.35 : 0.9;
  const material = new MeshStandardMaterial({
    color: input.colors.ground,
    transparent: true,
    opacity,
    depthWrite: !buried,
    roughness: 1,
  });
  const mesh = new Mesh(geometry, material);
  // Drawn before everything else: three.js sorts transparent objects by their
  // centre, and a ground disc centred under the building sorted between the
  // lid's storeys, painting a dark wedge of ground over a basement floor.
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * The building card's scene: the model cut open at the target floor, that
 * floor's rooms inside, the real ground around it. Draws only when asked — on
 * load, resize and drag — never in a loop.
 */
export function createBuildingScene(canvas: HTMLCanvasElement, input: SceneInput): BuildingScene {
  const { meta } = input.model;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x7a7a70, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(-50, 90, 60);
  scene.add(sun);
  scene.add(groundMesh(input));
  const camera = new PerspectiveCamera(FOV, 1, 1, 3000);

  const target = meta.storeys.find((s) => s.level === input.targetLevel);
  const lookY = target ? target.elevation + 2 : meta.height / 2;
  const top = meta.height + (target ? LIFT_M : 0);
  const home: View = { azimuth: meta.defaultAzimuthDeg, pitch: HOME_PITCH };
  let view = home;
  let disposed = false;

  const place = () => {
    // Frame the footprint and the lifted lid, a little tight: the ground can crop.
    const extent = Math.hypot(meta.radius * 0.8, Math.max(top - lookY, lookY) * 0.6);
    const hFov = 2 * Math.atan(Math.tan((FOV * Math.PI) / 360) * camera.aspect);
    const d = extent / Math.sin(Math.min((FOV * Math.PI) / 180, hFov) / 2);
    const [a, p] = [(view.azimuth * Math.PI) / 180, (view.pitch * Math.PI) / 180];
    camera.position.set(
      d * Math.cos(p) * Math.sin(a),
      lookY + d * Math.sin(p),
      -d * Math.cos(p) * Math.cos(a)
    );
    camera.lookAt(0, lookY, 0);
  };
  const render = () => {
    if (disposed) return;
    place();
    renderer.render(scene, camera);
  };

  new GLTFLoader().parse(
    input.model.glb,
    '',
    (gltf) => {
      if (disposed) return;
      applyCutaway(gltf.scene, input);
      scene.add(gltf.scene);
      if (target && input.rooms.length > 0) {
        scene.add(
          buildFloorSlab({
            rooms: input.rooms,
            project: makeProjector(meta.anchor),
            elevation: target.elevation,
            storeyHeight: target.height,
            targetRoomId: input.targetRoomId,
            colors: input.colors,
          })
        );
      }
      canvas.dataset.ready = 'true';
      render();
    },
    (err) => {
      canvas.dataset.ready = 'failed';
      input.onFailure?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
  const detach = attachOrbit(canvas, home, (next) => {
    view = next;
    render();
  });

  return {
    resize(width, height) {
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    },
    dispose() {
      disposed = true;
      detach();
      scene.traverse((o) => {
        if (!(o instanceof Mesh) && !('geometry' in o)) return;
        const m = o as Mesh;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat?.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
