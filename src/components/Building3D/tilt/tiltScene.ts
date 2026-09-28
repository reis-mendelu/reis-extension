import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { BuildingGroupInput } from '../buildingGroup';
import { boxOnScreen, labelsOnScreen, type OnScreenLabel } from './roomLabelLayer';
import type { ScreenBox } from './roomLabels';
import { makeProjector } from '../projection';
import { storeyCeiling } from '../cutaway';
import { applyTilt, screenOf } from './cameraRig';
import { addTiltContent } from './tiltContent';
import { sizeFatLines } from './fatLines';
import { disposeScene } from './disposeScene';
import { attachTiltGestures } from './tiltGestures';
import {
  clampTilt,
  flatDistance,
  FLAT_PITCH,
  frameBuilding,
  localMetresPerPixel,
  mixTilt,
  type Band,
  type MapView,
  type TiltCamera,
} from './tiltCamera';

export type { MapView };

export interface TiltSceneInput extends BuildingGroupInput {
  canvas: HTMLCanvasElement;
  view: MapView;
  /** The route's staircase on this floor, lit in the route colour. */
  routeRoomIds?: number[];
  /** The part of the canvas the sheet and search bar leave visible. */
  band: Band;
  /** Where the room's label pin goes, in canvas pixels, or null to hide it. */
  onLabel: (at: { x: number; y: number } | null) => void;
  /** The floor's room names on screen, and the lit room's box they keep off. */
  onRoomLabels: (labels: OnScreenLabel[] | null, room: ScreenBox | null) => void;
  /** A gesture asked to go back to the flat map. */
  onRequestLeave: () => void;
}

const FOV = 40;
const TILT_PITCH = 50;
const SKY = '#e4e9ee';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The map, tilted around one building. It starts as the flat map's exact
 * picture (`flat`: straight down, Leaflet's scale), then glides to `framed` —
 * the building whole in the visible band, pitched, north up — while the
 * building rises out of the ground and its rooms fade from the flat map's
 * colours to glass and one lit room. `leave` glides back.
 */
export function createTiltScene(input: TiltSceneInput) {
  const { canvas, view, model, band } = input;
  const { meta } = model;
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Sizes the canvas's CSS box too: stretched to its container instead, the
  // on-screen keyboard squashed the whole scene (and put labels off their pins).
  renderer.setSize(view.width, view.height);

  const project = makeProjector(meta.anchor);
  const groundY = meta.ground.a;
  const [tx, tz] = project(view.center);
  const flatD = flatDistance(view.height, localMetresPerPixel(view.center[1], view.zoom).y, FOV);
  const flat: TiltCamera = {
    target: [tx, groundY, tz],
    distance: flatD,
    pitch: FLAT_PITCH,
    offsetY: 0,
  };
  // Framed on what is drawn — the building up to the room's storey — so the
  // camera stays on that floor instead of backing off to the full height.
  const drawnHeight = storeyCeiling(meta.storeys, input.targetLevel, meta.height);
  const framed = frameBuilding(meta.radius, drawnHeight, FOV, TILT_PITCH, band);
  let cam = flat;

  const scene = new Scene();
  scene.background = new Color(SKY);
  // Beyond the flat frame's ground, so the handover picture is untinted.
  scene.fog = new Fog(
    SKY,
    Math.max(flatD, framed.distance) * 1.4,
    Math.max(flatD, framed.distance) * 5
  );
  scene.add(new HemisphereLight(0xffffff, 0x7a7a70, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.7);
  sun.position.set(-50, 90, 60);
  scene.add(sun);
  const near = Math.max(0.5, Math.min(flatD, framed.distance) / 300);
  const camera = new PerspectiveCamera(
    FOV,
    view.width / view.height,
    near,
    Math.max(flatD, framed.distance) * 12
  );

  let rise = 0;
  let frame = 0;
  let disposed = false;

  const render = () => {
    if (disposed) return;
    applyTilt(camera, cam, view.width, view.height);
    const c = content;
    if (c.shell) {
      // The glass grows out of the ground; flat, it would only z-fight the rooms.
      c.shell.scale.y = Math.max(0.001, rise);
      c.shell.visible = rise > 0.02;
    }
    // The floor's rooms start where the flat map drew them, on the ground, and
    // ride up into their storey as the building rises around them.
    if (c.slab) c.slab.position.y = (1 - rise) * (groundY + 0.15 - c.slabElevation);
    c.fade?.(rise);
    if (c.stem) c.stem.visible = rise > 0.97;
    renderer.render(scene, camera);
    const at = c.pin && rise > 0.97 ? screenOf(camera, c.pin, view.width, view.height) : null;
    input.onLabel(at && at.inFront ? { x: at.x, y: at.y } : null);
    const shown = rise > 0.97;
    input.onRoomLabels(
      shown ? labelsOnScreen(camera, c.labels, view) : null,
      shown ? boxOnScreen(camera, c.roomCorners, view) : null
    );
  };

  const { content, ready: loaded } = addTiltContent(scene, input, project, groundY, () => render());
  const ready = loaded.then(() => {
    sizeFatLines(scene, view.width, view.height);
    render();
  });

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
    /** The camera state and a ground probe, for the drag test and debugging. */
    debug: { get: () => cam, camera, groundY },
    /** `instant`: already tilted (a new room chosen while in 3D) — no glide. */
    enter(done?: () => void, instant = false) {
      animate(
        instant ? 1 : 950,
        (t) => {
          cam = mixTilt(flat, framed, t);
          rise = t;
        },
        () => {
          detach = attachTiltGestures({
            canvas,
            camera,
            groundY,
            size: () => ({ width: view.width, height: view.height }),
            get: () => cam,
            set: (next) => {
              cam = clampTilt(next, framed, meta.radius);
              render();
              return cam;
            },
            maxDistance: () => framed.distance * 1.5,
            onLeave: input.onRequestLeave,
          });
          done?.();
        }
      );
    },
    leave(done?: () => void) {
      detach?.();
      detach = null;
      const from = cam;
      animate(
        750,
        (t) => {
          cam = mixTilt(from, flat, t);
          rise = 1 - t;
        },
        done
      );
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      detach?.();
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export type TiltScene = ReturnType<typeof createTiltScene>;
