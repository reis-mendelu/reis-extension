import { lazy, Suspense, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { cutTarget, nextTiltEntry, targetFromSelection, type TiltEntry } from '../roomTarget';
import { floorText } from '../floorText';
import { map3dEnabled } from '../../../data/map/buildingModels';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { leaveTilt, tiltClosed } from './tiltActions';

const TiltCanvas = lazy(() => import('./TiltCanvas'));
const META = buildingsJson as BuildingsMeta;

/** The level of the floor the floor column shows, or null. */
function floorLevelOf(buildingId: number | null, floorId: number | null): number | null {
  const b = META.buildings.find((x) => x.id === buildingId);
  return b?.floors.find((f) => f.id === floorId)?.level ?? null;
}

/**
 * The tilted map, mounted over Leaflet while `mapTilt` says so. It opens only
 * from the 3D button: a room selection answers with the flat plan, which is the
 * clearer answer, and the map no longer moves on its own a second later.
 */
export function TiltToggle() {
  return map3dEnabled() ? <TiltLayer /> : null;
}

function TiltLayer() {
  const { t } = useTranslation();
  const { phase, view } = useAppStore((s) => s.mapTilt);
  const building = useAppStore((s) => s.activeBuildingId);
  const floorLevel = useAppStore((s) => floorLevelOf(s.activeBuildingId, s.activeFloorId));
  const model = useAppStore((s) => (building === null ? undefined : s.buildingModels[building]));
  const rooms = useAppStore((s) => (building === null ? undefined : s.roomsByBuilding[building]));
  const selection = useAppStore((s) => s.mapSelection);
  const { level, room } = cutTarget(targetFromSelection(selection), building, floorLevel);
  const roomId = room?.roomId ?? null;
  const pinText = room ? `${room.label} · ${floorText(level, t)}` : null;
  const floorRooms = useMemo(
    () => (rooms ? rooms.features.filter((f) => f.properties.floorLevel === level) : []),
    [rooms, level]
  );

  // A new floor or room while tilted rebuilds the scene (keyed below) straight
  // into the tilted frame; only the scene an entry started with does the glide.
  const sceneKey = `${level}:${roomId}`;
  const [entry, setEntry] = useState<TiltEntry | null>(null);
  const next = nextTiltEntry(entry, phase !== 'flat', sceneKey);
  if (next !== entry) setEntry(next);

  if (phase === 'flat' || !view || !model || model === 'failed') return null;
  return (
    <Suspense fallback={null}>
      <TiltCanvas
        key={sceneKey}
        startTilted={next !== null && (next.moved || next.key !== sceneKey)}
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
