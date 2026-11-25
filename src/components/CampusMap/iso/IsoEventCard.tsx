import { useTranslation } from '../../../hooks/useTranslation';
import { useEscapeLayer } from '../../../hooks/ui/useEscapeLayer';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

/**
 * The event a pin opened, over the isometric picture: the same card the 2D map's sheet
 * shows, so what a student reads about an event is one thing on both maps. No "Show on map":
 * the pin the student tapped is already on the map, in the picture they are looking at.
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
  // Escape (and Android back, via the overlay) peels the card first, then the map.
  useEscapeLayer(true, onClose);
  return (
    <div
      data-testid="iso-event-card"
      className={`absolute inset-x-3 z-[1] overflow-y-auto rounded-xl bg-base-100 shadow-popover-heavy md:right-auto md:w-96 ${clearNav ? 'bottom-[calc(6rem_+_var(--safe-bottom,0px))] max-h-[calc(100%_-_9rem_-_var(--safe-top,0px)_-_var(--safe-bottom,0px))]' : 'bottom-12 max-h-[calc(100%_-_7rem_-_var(--safe-top,0px))]'}`}
    >
      <EventDetailCard event={event} flush onClose={onClose} closeLabel={t('map.isoClose')} />
    </div>
  );
}
