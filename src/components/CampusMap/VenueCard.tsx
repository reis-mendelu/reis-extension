import { useAppStore } from '../../store/useAppStore';
import { useWideViewport } from '../../hooks/ui/useWideViewport';
import { VenueHeader } from './VenueHeader';
import { VenueMenu, VenueMenuPage } from './VenueMenu';
import { VenueEvents, VenueLunch, VenuePhotos } from './VenueSections';
import type { SocietyPin, Venue } from '../../types/campusMap';

/**
 * A venue (`venues`, S-klub's café), opened: who and where, open now or when
 * it opens, a closure notice, directions and Instagram, photos, lunch, the
 * menu and the society's events.
 *
 * One card for every surface — the extension's panel, the iPad's rail and the
 * phone's sheet. Width decides only the menu: chips with the items below where
 * there is room, a grid of categories that opens a page of its own on a phone.
 */
export function VenueCard({
  pin,
  venue,
  flush = false,
}: {
  pin: SocietyPin;
  venue: Venue;
  flush?: boolean;
}) {
  const now = useAppStore((s) => s.now);
  const sectionId = useAppStore((s) => s.venueMenuSection);
  const wide = useWideViewport();
  const frame = flush ? '' : 'overflow-hidden rounded-lg border border-base-300 bg-base-100';

  if (!wide && sectionId && venue.menu.some((m) => m.id === sectionId)) {
    return (
      <div data-testid="society-pin-card" className={frame}>
        <div className="p-3">
          <VenueMenuPage venue={venue} title={pin.title} sectionId={sectionId} />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="society-pin-card" className={frame}>
      <div className="space-y-4 p-3" data-testid="venue-card">
        <VenueHeader pin={pin} venue={venue} now={now} />
        <VenuePhotos photos={venue.photos} />
        <VenueLunch pin={pin} venue={venue} now={now} />
        <VenueMenu venue={venue} wide={wide} />
        <VenueEvents societyId={pin.societyId} />
      </div>
    </div>
  );
}
