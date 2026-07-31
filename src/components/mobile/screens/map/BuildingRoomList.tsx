import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { roomLabel } from '../../../CampusMap/mapHelpers';

/**
 * Budova tab body: the flat list of rooms on the active building + floor.
 * Reads `roomsByBuilding` — the same data `MapCanvas` already fetched via
 * `loadMapBuilding` for its own polygons — so there is nothing extra to load
 * here. No "reuse for reuse's sake" component existed for a flat room list on
 * desktop (it draws rooms as map polygons instead), so this is intentionally
 * a small new list, not a reused CampusMap component.
 */
export function BuildingRoomList({ buildingId }: { buildingId: number }) {
  const { t } = useTranslation();
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const fc = useAppStore((s) => s.roomsByBuilding[buildingId]);

  const rooms = (fc?.features ?? []).filter(
    (f) => f.properties.category !== 'structure' && f.properties.floorId === activeFloorId
  );

  if (rooms.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-base-content/50">
        {t('mobile.map.noRoomsOnFloor')}
      </p>
    );
  }

  return (
    <ul>
      {rooms.map(({ properties: p }) => (
        <li
          key={p.id}
          className="flex items-center gap-3 border-b border-base-200 px-4 py-2.5 last:border-0"
        >
          <span className="w-10 flex-shrink-0 text-center font-mono text-sm font-bold text-base-content/70">
            {roomLabel(p.name, p.passportNumber, p.nickname)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-base-content/60">{p.label}</span>
        </li>
      ))}
    </ul>
  );
}
