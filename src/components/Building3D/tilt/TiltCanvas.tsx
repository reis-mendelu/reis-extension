import { useEffect, useRef } from 'react';
import { createTiltScene, type MapView, type TiltScene } from './tiltScene';
import { resolveThemeColor } from '../themeColor';
import { flatMapLook } from './mapOverlays';
import type { BuildingModel } from '../../../types/buildingModel';
import type { RoomFeature } from '../../../types/campusMap';

export interface TiltCanvasProps {
  view: MapView;
  model: BuildingModel;
  rooms: RoomFeature[];
  targetLevel: number | null;
  targetRoomId: number | null;
  leaving: boolean;
  onRequestLeave: () => void;
  onClosed: () => void;
}

/**
 * The lazy half of the tilted map (three.js lives behind it). Invisible until
 * its first frame is the Leaflet view it covers; then it tilts.
 */
export default function TiltCanvas(props: TiltCanvasProps) {
  const { view, model, rooms, targetLevel, targetRoomId, leaving, onRequestLeave, onClosed } =
    props;
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TiltScene | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // A fresh canvas per scene — see Building3DCanvas for why a reused one breaks.
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full touch-none';
    canvas.dataset.testid = 'tilt-canvas';
    host.appendChild(canvas);
    const scene = createTiltScene({
      canvas,
      view,
      model,
      rooms,
      targetLevel,
      targetRoomId,
      lookOf: flatMapLook,
      colors: {
        room: resolveThemeColor(host, 'bg-base-300', '#d4d4d4'),
        target: resolveThemeColor(host, 'bg-primary', '#16a34a'),
        edge: '#6b7280',
      },
    });
    sceneRef.current = scene;
    void scene.ready.then(() => {
      host.classList.remove('invisible');
      canvas.dataset.ready = 'flat';
      // SPIKE: `?map3d=hold` stops on the handover frame, to diff it against Leaflet.
      if (new URLSearchParams(window.location.search).get('map3d') === 'hold') return;
      scene.enter(() => (canvas.dataset.ready = 'true'));
    });
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) onRequestLeave(); // zooming out leaves 3D, as on the flat map
    };
    canvas.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      scene.dispose();
      sceneRef.current = null;
      canvas.remove();
    };
    // The scene is built once per entry; leaving is driven by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (leaving) sceneRef.current?.leave(onClosed);
  }, [leaving, onClosed]);

  return <div ref={ref} className="invisible absolute inset-0 z-[450]" />;
}
