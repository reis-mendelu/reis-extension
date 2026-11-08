import { ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSociety } from '../../hooks/useSociety';
import { SocietyLogo } from '../SocietyLogo';
import { VenueDetails } from './VenueDetails';
import type { SocietyPin } from '../../types/campusMap';

/**
 * A society pin, opened: the same identity row as `EventDetailCard` (logo,
 * title, society), the society's short description, and "Více informací" to
 * its website. No date or venue — a pin is a place on the map for a while, not
 * an event. A permanent venue (S-klub's café, `data/map/venues.ts`) adds its
 * hours, lunch, menu and events through VenueDetails.
 */
export function SocietyPinCard({ pin, flush = false }: { pin: SocietyPin; flush?: boolean }) {
  const { t } = useTranslation();
  const soc = useSociety(pin.societyId)!;

  return (
    <div
      data-testid="society-pin-card"
      className={flush ? '' : 'overflow-hidden rounded-lg border border-base-300 bg-base-100'}
    >
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-3">
          <SocietyLogo
            society={soc}
            className="h-11 w-11 rounded-full ring-1 ring-base-300 text-sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-bold leading-tight text-base-content">{pin.title}</h3>
            {soc.name !== pin.title && (
              <span className="block min-w-0 truncate text-xs text-base-content/60">
                {soc.name}
              </span>
            )}
          </div>
        </div>
        {pin.venue && <VenueDetails venue={pin.venue} societyId={pin.societyId} />}
        {pin.description && (
          <p className="whitespace-pre-line break-words text-sm text-base-content/80">
            {pin.description}
          </p>
        )}
        {pin.url && (
          <a
            href={pin.url}
            target="_blank"
            rel="noopener noreferrer"
            // As EventDetailCard: on Capacitor the capture-phase external link
            // handler opens target=_blank in the in-app browser.
            className="btn btn-primary btn-sm btn-block"
          >
            {t('map.moreInfo')} <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
