import { DoorOpen } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { DirectionsList } from '../RoomDirections';
import { useEntranceRoute } from './useEntranceRoute';

/**
 * "Cesta od vchodu": the way from the door to the picked room, asked for. The picture cannot say
 * "up" or "down" on its own, because nobody knows which floor a student stands on; a student who says
 * they are at the entrance does, so the steps start there, and the door and the stairs light on the map.
 * Offered only where there is a mapped door and a staircase to name.
 */
export function IsoRouteCard({ clearNav }: { clearNav: boolean }) {
  const { t } = useTranslation();
  const { pick, way } = useEntranceRoute();
  const setRoute = useAppStore((s) => s.setIsoRouteTo);
  const on = way !== null;
  if (!pick && !way) return null;
  return (
    <div
      className={`absolute inset-x-3 z-[1] flex flex-col items-start gap-2 md:right-auto md:w-96 ${clearNav ? 'bottom-[calc(8rem_+_var(--safe-bottom,0px))]' : 'bottom-12'}`}
    >
      {way && (
        <div
          data-testid="iso-route"
          role="region"
          aria-label={t('map.isoRoute')}
          className="w-full rounded-lg bg-base-100 p-3 shadow-popover-heavy"
        >
          <DirectionsList directions={way} />
        </div>
      )}
      <button
        type="button"
        data-testid="iso-route-toggle"
        aria-pressed={on}
        onClick={() => setRoute(on ? null : pick)}
        className={`btn btn-sm gap-2 border shadow-popover-heavy ${on ? 'border-primary bg-primary text-primary-content' : 'border-base-content/30 bg-base-100 text-base-content'}`}
      >
        <DoorOpen size={14} aria-hidden="true" />
        {t('map.isoRoute')}
      </button>
    </div>
  );
}
