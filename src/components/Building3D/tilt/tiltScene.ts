import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Group,
} from 'three';
import { buildingOutlines } from './mapOverlays';
import { loadBuildingGroup, type BuildingGroupInput } from '../buildingGroup';
import { makeProjector } from '../projection';
import { attachOrbit, clampPitch, type View } from '../orbit';
import { cameraPosition, flatDistance, FLAT_PITCH, localMetresPerPixel } from './tiltCamera';
import { buildTileGround } from './tileGround';

export interface MapView {
  center: [number, number]; // [lng, lat]
  zoom: number;
  width: number;
  height: number;
}

export interface TiltSceneInput extends BuildingGroupInput {
  canvas: HTMLCanvasElement;
  view: MapView;
}

const FOV = 40;
const TILT_PITCH = 52;
const NORTH_UP = 180; // camera south of the target, looking north — the map's orientation
const SKY = '#e4e9ee';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The map, tilted. At `FLAT_PITCH` this scene is the Leaflet view it replaces —
 * the same tiles at the same scale from straight above — so handing over is
 * invisible; `enter` then tilts it while building Q rises out of the ground,
 * and `leave` plays that backwards so Leaflet can take the picture back.
 */
export function createTiltScene(input: TiltSceneInput) {
  const { canvas, view, model } = input;
  const { meta } = model;
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(view.width, view.height, false);

  const project = makeProjector(meta.anchor);
  const groundY = meta.ground.a;
  const [tx, tz] = project(view.center);
  const distance = flatDistance(view.height, localMetresPerPixel(view.center[1], view.zoom).y, FOV);

  const scene = new Scene();
  scene.background = new Color(SKY);
  // Past the handover frame's ground (at `distance`), so the flat picture is
  // untinted; it only greys out the horizon once the camera tilts.
  scene.fog = new Fog(SKY, distance * 1.4, distance * 5);
  scene.add(new HemisphereLight(0xffffff, 0x7a7a70, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(-50, 90, 60);
  scene.add(sun);

  const camera = new PerspectiveCamera(
    FOV,
    view.width / view.height,
    Math.max(0.5, distance / 200),
    distance * 12
  );
  let current: View = { azimuth: NORTH_UP, pitch: FLAT_PITCH };
  let shell: Group | null = null;
  let slab: Group | null = null;
  let slabElevation = 0;
  let rise = 0; // building height, 0 (flat on the map) … 1
  let frame = 0;
  let disposed = false;

  const render = () => {
    if (disposed) return;
    camera.position.set(...cameraPosition([tx, tz], distance, current.azimuth, current.pitch));
    camera.position.y += groundY;
    camera.lookAt(tx, groundY, tz);
    if (shell) {
      // The shell grows out of the ground; flat, it would only z-fight the rooms.
      shell.scale.y = Math.max(0.001, rise);
      shell.visible = rise > 0.02;
    }
    // The floor's rooms start where the flat map drew them — on the ground —
    // and ride up to their storey as the building rises around them.
    if (slab) slab.position.y = (1 - rise) * (groundY + 0.15 - slabElevation);
    renderer.render(scene, camera);
  };

  // Near tiles at the map's own zoom; a coarser ring under them for the horizon.
  const onTile = () => render();
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
  scene.add(near.group, far.group, buildingOutlines(project, groundY + 0.1, meta.buildingId));

  // Ready to take over from Leaflet once the building is built and the tiles in
  // view have arrived (mostly from the browser cache — Leaflet just drew them).
  const ready = Promise.all([
    loadBuildingGroup(input).then((parts) => {
      if (disposed) return;
      ({ shell, slab, slabElevation } = parts);
      scene.add(parts.shell);
      if (parts.slab) scene.add(parts.slab);
    }),
    Promise.race([near.loaded, new Promise((r) => setTimeout(r, 4000))]),
  ]).then(() => render());

  const animate = (ms: number, step: (t: number) => void, done?: () => void) => {
    cancelAnimationFrame(frame);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      step(ease(t));
      render();
      if (t < 1) frame = requestAnimationFrame(tick);
      else done?.();
    };
    frame = requestAnimationFrame(tick);
  };

  let detach: (() => void) | null = null;
  return {
    ready,
    renderFlat: render,
    enter(done?: () => void) {
      const from = { ...current };
      animate(
        900,
        (t) => {
          current = { azimuth: from.azimuth, pitch: from.pitch + (TILT_PITCH - from.pitch) * t };
          rise = t;
        },
        () => {
          detach = attachOrbit(canvas, { azimuth: NORTH_UP, pitch: TILT_PITCH }, (next) => {
            current = { azimuth: next.azimuth, pitch: clampPitch(next.pitch) };
            render();
          });
          done?.();
        }
      );
    },
    leave(done?: () => void) {
      detach?.();
      detach = null;
      const from = { ...current };
      const dAz = ((NORTH_UP - from.azimuth + 540) % 360) - 180;
      animate(
        700,
        (t) => {
          current = {
            azimuth: from.azimuth + dAz * t,
            pitch: from.pitch + (FLAT_PITCH - from.pitch) * t,
          };
          rise = 1 - t;
        },
        done
      );
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      detach?.();
      scene.traverse((o) => {
        const m = o as {
          geometry?: { dispose(): void };
          material?: { dispose(): void; map?: { dispose(): void } | null };
        };
        m.geometry?.dispose();
        m.material?.map?.dispose();
        m.material?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export type TiltScene = ReturnType<typeof createTiltScene>;
