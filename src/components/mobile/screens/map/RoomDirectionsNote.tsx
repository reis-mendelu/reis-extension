import { useTranslation } from '../../../../hooks/useTranslation';
import { floorText } from '../../../CampusMap/floorText';
import { directionSummary } from '../../../CampusMap/roomDirectionLines';
import { useRoomDirections } from '../../../CampusMap/useRoomDirections';

/**
 * "Q39 · 3. patro" over "Východní vchod · ↑ západní schodiště nebo výtah": the
 * selected room's floor in words and its way in, on one line each — in the
 * sheet's peek row, so a lesson's pin is not covered by a card, and at the top
 * of the tablet's rail. The full steps are one tap up, in the panel.
 */
export function RoomDirectionsNote() {
  const { t } = useTranslation();
  const directions = useRoomDirections();
  if (!directions) return null;
  return (
    <span className="min-w-0 flex-1" data-testid="room-directions-note">
      <span className="block truncate text-[13.5px] font-semibold text-base-content">
        {`${directions.label} · ${floorText(directions.level, t)}`}
      </span>
      <span className="mt-0.5 block truncate text-[12px] text-base-content/70">
        {directionSummary(directions.steps, t)}
      </span>
    </span>
  );
}
