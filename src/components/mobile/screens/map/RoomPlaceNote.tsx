import { useTranslation } from '../../../../hooks/useTranslation';
import { placeTitle } from '../../../CampusMap/mapHelpers';
import { useForRoomSelection } from './useForRoomSelection';

/**
 * "T18" over "Budova T · bez plánku podlaží": a lesson whose room has no floor
 * plan, shown at its building. The phone has no floating card for a building
 * pin, so this is the only thing that says why the camera moved — in the
 * sheet's peek row, and at the top of the tablet's rail.
 */
export function RoomPlaceNote() {
  const { t } = useTranslation();
  const forRoom = useForRoomSelection();
  if (!forRoom) return null;
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13.5px] font-semibold text-base-content">
        {forRoom.room}
      </span>
      <span className="mt-0.5 block truncate text-[12px] text-base-content/60">
        {`${placeTitle(forRoom.building, t)} · ${t('map.noFloorPlanShort')}`}
      </span>
    </span>
  );
}
