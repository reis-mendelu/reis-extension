import { useEffect, useRef } from 'react';
import { createTiltScene, type TiltScene } from './tiltScene';
import { resolveThemeColor } from '../themeColor';
import { flatMapLook } from './mapOverlays';
import { applyTilt, groundAt, screenOf } from './cameraRig';
import { markWebGL2Unavailable } from '../webgl';
import { logError } from '../../../utils/reportError';
import { clampLabelX, clampLabelY, type Band, type MapView } from './tiltCamera';
import { createLabelLayer } from './roomLabelLayer';
import type { ScreenBox } from './roomLabels';
import type { BuildingModel } from '../../../types/buildingModel';
import type { RoomFeature } from '../../../types/campusMap';

export interface TiltCanvasProps {
  view: MapView;
  model: BuildingModel;
  rooms: RoomFeature[];
  targetLevel: number | null;
  targetRoomId: number | null;
  /** The route's staircase on this floor (room directions), lit in the route colour. */
  routeRoomIds: number[];
  /** "Q32 · 3. patro" — null when no room is selected, and then no pin. */
  pinText: string | null;
  leaving: boolean;
  /** Already tilted when this scene was built (a new room chosen in 3D): skip
   *  the fade and the glide, and appear framed straight away. */
  startTilted: boolean;
  onRequestLeave: () => void;
  onClosed: () => void;
}

const FADE_MS = 300; // the cross-fade from Leaflet, matched to duration-300 below

/**
 * The part of the canvas the map's own chrome leaves visible: under the search
 * bar, above the phone's sheet. Read from the DOM, as panPinClearOfSheet does —
 * a sheet that hugs its content has no height anyone could predict.
 */
function visibleBand(host: HTMLElement): Band {
  const box = host.getBoundingClientRect();
  const search = host.parentElement?.querySelector('label')?.getBoundingClientRect();
  const sheet = document.querySelector('[data-testid="map-sheet"]')?.getBoundingClientRect();
  const top = search ? Math.max(0, search.bottom - box.top + 8) : 16;
  const bottom = sheet ? Math.min(box.height, sheet.top - box.top - 8) : box.height - 16;
  return { top, bottom: Math.max(top + 120, bottom), width: box.width, height: box.height };
}

/**
 * The lazy half of the tilted map (three.js lives behind it). Invisible until
 * its first frame is the Leaflet view it covers; then it tilts.
 */
export default function TiltCanvas(props: TiltCanvasProps) {
  const {
    view,
    model,
    rooms,
    targetLevel,
    targetRoomId,
    routeRoomIds,
    pinText,
    leaving,
    startTilted,
    onRequestLeave,
    onClosed,
  } = props;
  const ref = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TiltScene | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const roomLabels = createLabelLayer(host);
    let pinBox: ScreenBox | null = null;
    const band = visibleBand(host);
    const buildScene = (canvas: HTMLCanvasElement) =>
      createTiltScene({
        canvas,
        view,
        band,
        model,
        rooms,
        targetLevel,
        targetRoomId,
        routeRoomIds,
        lookOf: flatMapLook,
        onRequestLeave,
        onLabel: (at) => {
          const pin = pinRef.current;
          if (!pin) return;
          pin.classList.toggle('opacity-0', !at);
          pinBox = null;
          // Kept whole on screen: a room on the building's edge put it half off.
          if (at) {
            const [w, h] = [pin.offsetWidth, pin.offsetHeight];
            const x = clampLabelX(at.x, w, view.width);
            const y = clampLabelY(at.y, h, band.top);
            pin.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
            pinBox = { x, y: y - h / 2, w, h };
          }
        },
        onRoomLabels: (labels, room) =>
          roomLabels(
            labels,
            [pinBox, room].filter((b): b is ScreenBox => b !== null)
          ),
        colors: {
          room: resolveThemeColor(host, 'bg-base-300', '#d4d4d4'),
          target: resolveThemeColor(host, 'bg-primary', '#16a34a'),
          edge: '#6b7280',
        },
      });
    // A fresh canvas per scene: a canvas whose context was lost or disposed
    // cannot hand a new renderer a working one.
    const canvas = document.createElement('canvas');
    canvas.className = 'block touch-none';
    canvas.dataset.testid = 'tilt-canvas';
    host.prepend(canvas);
    let scene: TiltScene;
    try {
      scene = buildScene(canvas);
    } catch (err) {
      // A device can advertise WebGL2 and still fail to build a renderer (seen
      // in an embedded browser). The flat map is still there under this layer.
      logError('TiltCanvas.createScene', err);
      markWebGL2Unavailable();
      canvas.remove();
      onClosed();
      return;
    }
    // Routine on iOS (backgrounding, memory pressure): back to the flat map,
    // and the next room may try again.
    canvas.addEventListener('webglcontextlost', onClosed, { once: true });
    sceneRef.current = scene;
    // Dev only: a probe for the drag test — where a pixel's ground point is,
    // and where a ground point is on screen, under the live camera.
    const probe = import.meta.env.DEV && {
      groundAt: (x: number, y: number) => {
        applyTilt(scene.debug.camera, scene.debug.get(), view.width, view.height);
        const g = groundAt(scene.debug.camera, x, y, view.width, view.height, scene.debug.groundY);
        return g && { x: g.x, y: g.y, z: g.z };
      },
      screenOf: (p: { x: number; y: number; z: number }) => {
        applyTilt(scene.debug.camera, scene.debug.get(), view.width, view.height);
        const v = scene.debug.camera.position.clone().set(p.x, p.y, p.z);
        return screenOf(scene.debug.camera, v, view.width, view.height);
      },
      camera: () => scene.debug.get(),
    };
    if (probe) (window as unknown as { __reisTilt?: typeof probe }).__reisTilt = probe;
    void scene.ready.then(() => {
      // Fade in while still flat, then tilt. The flat frame matches Leaflet's
      // but for its room labels and hairline strokes; faded, those dissolve
      // instead of popping.
      host.classList.remove('invisible');
      if (startTilted) {
        host.classList.remove('transition-opacity', 'opacity-0');
        scene.enter(() => (canvas.dataset.ready = 'true'), true);
        return;
      }
      requestAnimationFrame(() => host.classList.remove('opacity-0'));
      canvas.dataset.ready = 'flat';
      // Dev only: `?map3d=hold` stops on the handover frame, to diff it against Leaflet.
      const hold = new URLSearchParams(window.location.search).get('map3d') === 'hold';
      if (import.meta.env.DEV && hold) return;
      setTimeout(() => scene.enter(() => (canvas.dataset.ready = 'true')), FADE_MS);
    });
    return () => {
      canvas.removeEventListener('webglcontextlost', onClosed);
      scene.dispose();
      sceneRef.current = null;
      canvas.remove();
      delete (window as unknown as { __reisTilt?: unknown }).__reisTilt;
    };
    // The scene is built once per entry; leaving is driven by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (leaving) sceneRef.current?.leave(onClosed);
  }, [leaving, onClosed]);

  return (
    <div
      ref={ref}
      className="invisible absolute inset-0 z-[450] overflow-hidden opacity-0 transition-opacity duration-300"
    >
      {pinText && (
        // Floats over the always-light basemap, so it carries the search bar's own
        // dark surface. Positioned by the scene every frame; no React re-render.
        <div
          ref={pinRef}
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full bg-[rgba(31,41,55,.94)] px-3 py-1.5 text-sm font-semibold text-white opacity-0 shadow-lg transition-opacity duration-200"
          data-testid="tilt-pin"
        >
          {pinText}
        </div>
      )}
    </div>
  );
}
