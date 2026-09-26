import { lazy, Suspense, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { targetFromSelection } from '../roomTarget';
import { floorText } from '../floorText';
import { TILT_SPIKE } from './tiltFlag';
import { leaveTilt, tiltClosed } from './tiltActions';

const TiltCanvas = lazy(() => import('./TiltCanvas'));

/** The tilted map, mounted over Leaflet while `mapTilt` says so. */
export function TiltToggle() {
  return TILT_SPIKE ? <TiltLayer /> : null;
}

function TiltLayer() {
  const { t } = useTranslation();
  const { phase, view } = useAppStore((s) => s.mapTilt);
  const building = useAppStore((s) => s.activeBuildingId);
  const model = useAppStore((s) => (building === null ? undefined : s.buildingModels[building]));
  const rooms = useAppStore((s) => (building === null ? undefined : s.roomsByBuilding[building]));
  const target = targetFromSelection(useAppStore((s) => s.mapSelection));
  const here = target !== null && target.buildingId === building;
  const level = here ? target.floorLevel : null;
  const roomId = here ? target.roomId : null;
  const pinText = here ? `${target.label} · ${floorText(level, t)}` : null;
  const floorRooms = useMemo(
    () => (rooms ? rooms.features.filter((f) => f.properties.floorLevel === level) : []),
    [rooms, level]
  );
  if (phase === 'flat' || !view || !model || model === 'failed') return null;
  return (
    <Suspense fallback={null}>
      <TiltCanvas
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
