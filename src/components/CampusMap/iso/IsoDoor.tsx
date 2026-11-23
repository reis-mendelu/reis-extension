import { useCallback, useEffect, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import { DoorOpen } from 'lucide-react';
import buildingsJson from '../../../data/map/buildings.json';
import type { BuildingsMeta } from '../../../types/campusMap';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { IMG, isoPixel } from '../../../data/map/isoView';
import { floorHeights } from '../../../data/map/isoFloors';
import { ROOM_ENTRANCES } from '../../../data/map/roomEntrances';
import { useEntranceRoute } from './useEntranceRoute';

const META = buildingsJson as BuildingsMeta;

/**
 * The building's door, on the floor that opens onto the street: that floor's plate is level with
 * the door, so the mark lands on it. On a higher floor the plate would hide it, so it is not drawn.
 * Placed from OpenSeadragon's viewport on every frame, like the floor ruler. It turns primary
 * once the student has asked for the way from the entrance to a picked room.
 */
export function IsoDoor({
  viewer,
  osd,
}: {
  viewer: OpenSeadragon.Viewer;
  osd: typeof OpenSeadragon;
}) {
  const { t } = useTranslation();
  const buildingId = useAppStore((s) => s.activeBuildingId);
  const floorId = useAppStore((s) => s.activeFloorId);
  const asked = useEntranceRoute().way !== null;
  const entrance = buildingId === null ? undefined : ROOM_ENTRANCES[buildingId];
  const b = META.buildings.find((x) => x.id === buildingId);
  const level = b?.floors.find((f) => f.id === floorId)?.level;
  const spot =
    b && entrance && level === entrance.level
      ? isoPixel(entrance.at[1], entrance.at[0], floorHeights(b).baseM)
      : null;
  const sx = spot?.px;
  const sy = spot?.py;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const place = useCallback(() => {
    if (sx === undefined || sy === undefined) return setPos(null);
    const p = viewer.viewport.pixelFromPoint(new osd.Point(sx / IMG.w, sy / IMG.w), true);
    setPos({ x: p.x, y: p.y });
  }, [viewer, osd, sx, sy]);

  useEffect(() => {
    const first = requestAnimationFrame(place);
    const events = ['animation', 'animation-finish', 'update-viewport', 'open', 'resize'] as const;
    events.forEach((e) => viewer.addHandler(e, place));
    return () => {
      cancelAnimationFrame(first);
      events.forEach((e) => viewer.removeHandler(e, place));
    };
  }, [viewer, place]);

  if (sx === undefined || !pos) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        data-testid="iso-door"
        data-asked={asked ? 'true' : undefined}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)` }}
        className={`absolute left-0 top-0 flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold shadow-sm ${
          asked
            ? 'border-primary bg-primary text-primary-content'
            : 'border-base-content/30 bg-base-100 text-base-content'
        }`}
      >
        <DoorOpen size={12} aria-hidden="true" />
        {t('map.isoDoor')}
      </span>
    </div>
  );
}
