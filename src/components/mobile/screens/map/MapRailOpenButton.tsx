import { PanelRightOpen } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { RoomDirectionsNote } from './RoomDirectionsNote';
import { useRoomDirections } from '../../../CampusMap/useRoomDirections';

/** What the tablet map rail leaves behind when it is closed (see MapRail). */
export function MapRailOpenButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const directions = useRoomDirections();
  // A selected room with directions: the pill carries its floor and way in, as
  // the phone's closed sheet does, and opens onto the full steps. The rail is
  // not opened for it — in portrait it would cover the floor column.
  if (directions)
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={false}
        className="absolute right-4 top-[calc(5rem_+_var(--safe-top,0px))] z-[1000] flex max-w-[22rem] items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 px-4 py-2.5 text-left shadow-drawer"
      >
        <RoomDirectionsNote />
        {/* The note names the room; this says what pressing it does. */}
        <span className="sr-only">{t('mobile.map.railOpen')}</span>
        <PanelRightOpen
          size={18}
          className="flex-shrink-0 text-base-content/70"
          aria-hidden="true"
        />
      </button>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('mobile.map.railOpen')}
      aria-expanded={false}
      // The one thing left behind when the rail is away: a pill at the edge
      // it went into, so the way back is where it left from.
      className="absolute right-4 top-[calc(5rem_+_var(--safe-top,0px))] z-[1000] flex h-11 w-11 items-center justify-center rounded-2xl border border-base-content/10 bg-base-100 shadow-drawer"
    >
      <PanelRightOpen size={18} className="text-base-content/70" />
    </button>
  );
}
