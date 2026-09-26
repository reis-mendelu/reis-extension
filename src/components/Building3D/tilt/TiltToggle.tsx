import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { getMapInstance } from '../../CampusMap/mapInstance';
import { hasWebGL2 } from '../webgl';
import { targetFromSelection } from '../roomTarget';
import { floorText } from '../floorText';
import type { MapView } from './tiltScene';

const TiltCanvas = lazy(() => import('./TiltCanvas'));

/**
 * SPIKE (#462, throwaway until the tilted map is judged): the map tilts into 3D
 * around building Q. Behind `?map3d=1`, or baked into a device test build.
 */
const TILT_SPIKE =
  // A phone app has no URL bar: a device test build bakes the flag in instead.
  import.meta.env?.VITE_MAP3D === '1' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('map3d'));
const Q = 0;

export function TiltToggle({ isPhone }: { isPhone: boolean }) {
  return TILT_SPIKE ? <TiltSpike isPhone={isPhone} /> : null;
}

function TiltSpike({ isPhone }: { isPhone: boolean }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'flat' | '3d' | 'leaving'>('flat');
  const [view, setView] = useState<MapView | null>(null);
  const model = useAppStore((s) => s.buildingModels[Q]);
  const rooms = useAppStore((s) => s.roomsByBuilding[Q]);
  const selection = useAppStore((s) => s.mapSelection);
  const target = targetFromSelection(selection);
  const inQ = target?.buildingId === Q;
  const level = inQ ? target.floorLevel : null;
  const roomId = inQ ? target.roomId : null;
  const pinText = inQ ? `${target.label} · ${floorText(level, t)}` : null;
  const floorRooms = useMemo(
    () => (rooms ? rooms.features.filter((f) => f.properties.floorLevel === level) : []),
    [rooms, level]
  );

  // Leaflet's own +/- would zoom the hidden flat map, and the way back to 2D
  // would then jump. Its controls go away while the map is tilted.
  const showLeafletControls = (show: boolean) =>
    getMapInstance()
      ?.getContainer()
      .querySelector('.leaflet-control-container')
      ?.classList.toggle('invisible', !show);

  const enter = async () => {
    const map = getMapInstance();
    if (!map || !hasWebGL2()) return;
    // The intent loads what the 3D map needs, the way a hover loads the card's.
    await useAppStore.getState().loadMapBuilding(Q);
    await useAppStore.getState().loadBuildingModel(Q);
    const c = map.getCenter();
    const size = map.getSize();
    setView({ center: [c.lng, c.lat], zoom: map.getZoom(), width: size.x, height: size.y });
    showLeafletControls(false);
    setPhase('3d');
  };
  const leave = useCallback(() => setPhase((p) => (p === '3d' ? 'leaving' : p)), []);
  const closed = useCallback(() => {
    showLeafletControls(true);
    setPhase('flat');
  }, []);

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
            pinText={pinText}
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
        // Phone: under the search bar, clear of the status bar and the floor stack.
        // Desktop: above Leaflet's zoom buttons, clear of the search and both panels.
        className={`btn btn-sm absolute z-[1001] border-none bg-neutral text-neutral-content ${
          isPhone ? 'right-4 top-[calc(var(--safe-top,0px)+5.75rem)]' : 'bottom-24 right-2.5'
        }`}
      >
        {phase === 'flat' ? '3D' : '2D'}
      </button>
    </>
  );
}
