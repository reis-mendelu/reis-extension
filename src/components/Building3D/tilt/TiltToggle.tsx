import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { targetFromSelection } from '../roomTarget';
import { floorText } from '../floorText';
import { map3dEnabled } from '../../../data/map/buildingModels';
import { enterTilt, leaveTilt, tiltClosed } from './tiltActions';
import { getMapInstance, subscribeMapInstance } from '../../CampusMap/mapInstance';

const TiltCanvas = lazy(() => import('./TiltCanvas'));

/** The tilted map, mounted over Leaflet while `mapTilt` says so. */
export function TiltToggle() {
  return map3dEnabled() ? <TiltLayer /> : null;
}

function TiltLayer() {
  const { t } = useTranslation();
  const { phase, view } = useAppStore((s) => s.mapTilt);
  const building = useAppStore((s) => s.activeBuildingId);
  const model = useAppStore((s) => (building === null ? undefined : s.buildingModels[building]));
  const rooms = useAppStore((s) => (building === null ? undefined : s.roomsByBuilding[building]));
  const selection = useAppStore((s) => s.mapSelection);
  const target = targetFromSelection(selection);
  const here = target !== null && target.buildingId === building;
  const level = here ? target.floorLevel : null;
  const roomId = here ? target.roomId : null;
  const pinText = here ? `${target.label} · ${floorText(level, t)}` : null;
  const floorRooms = useMemo(
    () => (rooms ? rooms.features.filter((f) => f.properties.floorLevel === level) : []),
    [rooms, level]
  );
  // Selecting a room in the building (a tap, search, a lesson's pin) tilts the
  // map straight into it — the room lit in the glass building, no card. Waits
  // for the map to finish flying there, since the tilt starts from its view.
  useEffect(() => {
    if (!here || useAppStore.getState().mapTilt.phase !== 'flat') return;
    // Dev only: `?map3d=hold` diffs the handover against Leaflet, so it tilts on the button only.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('map3d') === 'hold')
      return;
    // A lesson's map pin mounts the map tab and selects the room in one go, and
    // React runs this (child) effect before MapCanvas creates the Leaflet map —
    // so wait for the instance rather than giving up on a null one.
    let done = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let map: ReturnType<typeof getMapInstance> = null;
    const go = () => {
      if (done) return;
      done = true;
      void enterTilt({ load: false });
    };
    const onMoved = () => setTimeout(go, 250);
    const stop = subscribeMapInstance((m) => {
      if (!m || map) return;
      map = m;
      fallback = setTimeout(go, 900);
      m.once('moveend', onMoved);
    });
    return () => {
      done = true;
      stop();
      clearTimeout(fallback);
      map?.off('moveend', onMoved);
    };
    // Keyed on the selection object: each new selection tilts once; leaving to
    // 2D keeps the same object and so does not bounce straight back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // A new room while tilted rebuilds the scene (keyed below) straight into the
  // tilted frame; only the scene an entry started with does the handover glide.
  const sceneKey = `${level}:${roomId}`;
  const [entryKey, setEntryKey] = useState<string | null>(null);
  if (phase === 'flat' && entryKey !== null) setEntryKey(null);
  if (phase !== 'flat' && entryKey === null) setEntryKey(sceneKey);

  if (phase === 'flat' || !view || !model || model === 'failed') return null;
  return (
    <Suspense fallback={null}>
      <TiltCanvas
        key={sceneKey}
        startTilted={entryKey !== null && entryKey !== sceneKey}
        view={view}
        model={model}
        rooms={floorRooms}
        targetLevel={level}
        targetRoomId={roomId}
        pinText={pinText}
        leaving={phase === 'leaving'}
        onRequestLeave={leaveTilt}
        onClosed={tiltClosed}
      />
    </Suspense>
  );
}
