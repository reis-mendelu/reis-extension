import { useEffect, useRef, useState } from 'react';
import { createBuildingScene } from './scene';
import { resolveThemeColor } from './themeColor';
import { markWebGL2Unavailable } from './webgl';
import type { BuildingModel } from '../../types/buildingModel';
import type { RoomFeature } from '../../types/campusMap';

export interface Building3DCanvasProps {
  model: BuildingModel;
  rooms: RoomFeature[];
  targetLevel: number | null;
  targetRoomId: number | null;
  ariaLabel: string;
}

/**
 * The lazy half of the building card: everything that imports three.js lives
 * behind this module, so the library is a separate chunk that loads only when a
 * card actually opens — never on the IS Mendelu page, never in the main bundle.
 *
 * The effect drives an imperative WebGL scene, not a fetch: the model and rooms
 * arrive through props from the store.
 */
export default function Building3DCanvas({
  model,
  rooms,
  targetLevel,
  targetRoomId,
  ariaLabel,
}: Building3DCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  // A renderer that cannot be built, or a context the GPU takes back, is
  // re-thrown during render so the card's ErrorBoundary swaps in the flat plan.
  // Thrown straight out of the effect it blanked the whole app.
  const [failure, setFailure] = useState<Error | null>(null);
  if (failure) throw failure;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // A fresh canvas for every scene. Disposing forces the old context lost —
    // freeing GPU memory now, which iOS needs — and a canvas keeps handing out
    // its lost context, so reusing one (StrictMode's second run, a new room on
    // the same floor) built a renderer that could not read shader precision.
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full cursor-grab touch-none active:cursor-grabbing';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', ariaLabel);
    canvas.dataset.testid = 'building-3d-canvas';
    host.appendChild(canvas);
    // Only a renderer that cannot be BUILT turns 3D off for the session. A lost
    // context is routine on iOS — backgrounding, memory pressure, the per-page
    // context cap — so it fails this card alone and the next one tries again.
    const unusable = (err: Error) => {
      markWebGL2Unavailable();
      setFailure(err);
    };
    const onLost = () => setFailure(new Error('WebGL context lost'));
    canvas.addEventListener('webglcontextlost', onLost);
    let scene: ReturnType<typeof createBuildingScene>;
    try {
      scene = createBuildingScene(canvas, {
        model,
        rooms,
        targetLevel,
        targetRoomId,
        onFailure: setFailure,
        colors: {
          room: resolveThemeColor(host, 'bg-base-300', '#d4d4d4'),
          target: resolveThemeColor(host, 'bg-primary', '#16a34a'),
          edge: '#6b7280',
          ground: '#b9c7a8',
        },
      });
    } catch (err) {
      canvas.remove();
      unusable(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) scene.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas);
    return () => {
      // Our own disposal loses the context on purpose; that is not a failure.
      canvas.removeEventListener('webglcontextlost', onLost);
      observer.disconnect();
      scene.dispose();
      canvas.remove();
    };
  }, [model, rooms, targetLevel, targetRoomId, ariaLabel]);

  return <div ref={ref} className="h-full w-full" />;
}
