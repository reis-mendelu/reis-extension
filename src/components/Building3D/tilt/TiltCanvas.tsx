import { useEffect, useRef } from 'react';
import { createTiltScene, type MapView, type TiltScene } from './tiltScene';
import { resolveThemeColor } from '../themeColor';
import { flatMapLook } from './mapOverlays';
import { applyTilt, groundAt, screenOf } from './cameraRig';
import type { Band } from './tiltCamera';
import type { BuildingModel } from '../../../types/buildingModel';
import type { RoomFeature } from '../../../types/campusMap';

export interface TiltCanvasProps {
  view: MapView;
  model: BuildingModel;
  rooms: RoomFeature[];
  targetLevel: number | null;
  targetRoomId: number | null;
  /** "Q32 · 3. patro" — null when no room is selected, and then no pin. */
  pinText: string | null;
  leaving: boolean;
  onRequestLeave: () => void;
  onClosed: () => void;
}

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
    pinText,
    leaving,
    onRequestLeave,
    onClosed,
  } = props;
  const ref = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TiltScene | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // A fresh canvas per scene — see Building3DCanvas for why a reused one breaks.
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full touch-none';
    canvas.dataset.testid = 'tilt-canvas';
    host.prepend(canvas);
    const scene = createTiltScene({
      canvas,
      view,
      band: visibleBand(host),
      model,
      rooms,
      targetLevel,
      targetRoomId,
      lookOf: flatMapLook,
      onRequestLeave,
      onLabel: (at) => {
        const pin = pinRef.current;
        if (!pin) return;
        pin.classList.toggle('opacity-0', !at);
        if (at) pin.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -100%)`;
      },
      colors: {
        room: resolveThemeColor(host, 'bg-base-300', '#d4d4d4'),
        target: resolveThemeColor(host, 'bg-primary', '#16a34a'),
        edge: '#6b7280',
      },
    });
    sceneRef.current = scene;
    // SPIKE: a probe for the drag test — where a pixel's ground point is, and
    // where a ground point is on screen, under the live camera.
    const probe = {
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
    (window as unknown as { __reisTilt?: typeof probe }).__reisTilt = probe;
    void scene.ready.then(() => {
      host.classList.remove('invisible');
      canvas.dataset.ready = 'flat';
      // SPIKE: `?map3d=hold` stops on the handover frame, to diff it against Leaflet.
      if (new URLSearchParams(window.location.search).get('map3d') === 'hold') return;
      scene.enter(() => (canvas.dataset.ready = 'true'));
    });
    return () => {
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
    <div ref={ref} className="invisible absolute inset-0 z-[450] overflow-hidden">
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
