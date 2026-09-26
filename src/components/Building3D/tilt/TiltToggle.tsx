import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { getMapInstance } from '../../CampusMap/mapInstance';
import { hasWebGL2 } from '../webgl';
import { targetFromSelection } from '../roomTarget';
import type { MapView } from './tiltScene';

const TiltCanvas = lazy(() => import('./TiltCanvas'));

/**
 * SPIKE (throwaway until the handover is proven): the map tilts into 3D around
 * building Q. Behind `?map3d=1`, so nobody sees it without asking.
 */
const TILT_SPIKE =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('map3d');
const Q = 0;

export function TiltToggle() {
  return TILT_SPIKE ? <TiltSpike /> : null;
}

function TiltSpike() {
  const [phase, setPhase] = useState<'flat' | '3d' | 'leaving'>('flat');
  const [view, setView] = useState<MapView | null>(null);
  const model = useAppStore((s) => s.buildingModels[Q]);
  const rooms = useAppStore((s) => s.roomsByBuilding[Q]);
  const selection = useAppStore((s) => s.mapSelection);
  const target = targetFromSelection(selection);
  const level = target?.buildingId === Q ? target.floorLevel : null;
  const roomId = target?.buildingId === Q ? target.roomId : null;
  const floorRooms = useMemo(
    () => (rooms ? rooms.features.filter((f) => f.properties.floorLevel === level) : []),
    [rooms, level]
  );

  const enter = async () => {
    const map = getMapInstance();
    if (!map || !hasWebGL2()) return;
    // The intent loads what the 3D map needs, the way a hover loads the card's.
    await useAppStore.getState().loadMapBuilding(Q);
    await useAppStore.getState().loadBuildingModel(Q);
    const c = map.getCenter();
    const size = map.getSize();
    setView({ center: [c.lng, c.lat], zoom: map.getZoom(), width: size.x, height: size.y });
    setPhase('3d');
  };
  const leave = useCallback(() => setPhase((p) => (p === '3d' ? 'leaving' : p)), []);
  const closed = useCallback(() => setPhase('flat'), []);

  const ready = model && model !== 'failed' && view;
  return (
    <>
      {phase !== 'flat' && ready && (
        <Suspense fallback={null}>
          <TiltCanvas
            view={view}
            model={model}
            rooms={floorRooms}
            targetLevel={level}
            targetRoomId={roomId}
            leaving={phase === 'leaving'}
            onRequestLeave={leave}
            onClosed={closed}
          />
        </Suspense>
      )}
      <button
        type="button"
        onClick={phase === 'flat' ? () => void enter() : leave}
        // Floating over the always-light basemap, so it carries its own dark surface.
        className="btn btn-sm absolute right-3 top-24 z-[1001] border-none bg-neutral text-neutral-content"
      >
        {phase === 'flat' ? '3D' : '2D'}
      </button>
    </>
  );
}
