import { X, Map as MapIcon } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useEscapeLayer } from '../../../hooks/ui/useEscapeLayer';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

/**
 * The event a pin opened, over the isometric picture: the same card the 2D map's sheet
 * shows, so what a student reads about an event is one thing on both maps. "Show on map"
 * is the way back to the 2D map (and its building and floor), flown to this event.
 */
export function IsoEventCard({
  event,
  clearNav,
  onClose,
}: {
  event: MapEvent;
  clearNav: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const focusEvent = useAppStore((s) => s.focusEventById);
  // Escape (and Android back, via the overlay) peels the card first, then the map.
  useEscapeLayer(true, onClose);
  return (
    <div
      data-testid="iso-event-card"
      className={`absolute inset-x-3 z-[1] rounded-lg bg-base-100 shadow-popover-heavy md:right-auto md:w-96 ${clearNav ? 'bottom-[calc(8rem_+_var(--safe-bottom,0px))]' : 'bottom-12'}`}
    >
      <button
        type="button"
        aria-label={t('map.isoClose')}
        onClick={onClose}
        className="btn btn-circle btn-ghost btn-xs absolute right-1 top-1 z-[1]"
      >
        <X size={14} aria-hidden="true" />
      </button>
      <EventDetailCard event={event} flush />
      <div className="border-t border-base-300 p-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost w-full gap-2"
          onClick={() => focusEvent(event.id, { fly: true })}
        >
          <MapIcon size={14} aria-hidden="true" />
          {t('map.isoShowOnMap')}
        </button>
      </div>
    </div>
  );
}
