import { MapPin, Navigation } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { roomCodeToName } from './mapHelpers';
import type { RoomIndexEntry } from '../../types/campusMap';
import { openExternal } from '../../mobile/openExternal';
import { getPlatform } from '../../platform';
import { openVenue } from '../../mobile/openVenue';
import { logError } from '../../utils/reportError';
import { venueMapUrl } from '../../utils/venueMapUrl';
import type { MapEvent } from '../../types/events';

const INDEX = roomsIndexJson as RoomIndexEntry[];

export function EventVenueLine({
  event,
  societyShortName,
}: {
  event: MapEvent;
  societyShortName: string;
}) {
  const focusRoom = useAppStore((s) => s.focusRoomByCode);
  const { t } = useTranslation();
  /**
   * The venue row is gated on the COORDINATE, not on the name.
   *
   * A society that drops the pin by hand ("nebo vybrat ručně na mapě") saves a
   * coordinate and no location name — Photon named the searched venues, and
   * nothing names this one. The card used to require the name before it drew
   * anything at all, so those events showed no venue row whatsoever: a pin on
   * reIS's own map and no way to hand it to Maps. The student had to eyeball
   * the map and guess where to walk.
   *
   * The coordinate is what makes a venue openable, so the coordinate is what
   * decides whether the link exists; the name only decides what it is called.
   * Fixed here rather than in the composer because every hand-dropped event
   * already published carries `location: null` — a write-side default would
   * need a backfill to reach them.
   */
  const venueName = event.location?.trim() ? event.location.trim() : null;

  return event.roomCode ? (
    <button
      className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      onClick={() => focusRoom(event.roomCode!)}
    >
      <MapPin size={13} className="shrink-0" /> {roomCodeToName(event.roomCode, INDEX)}
    </button>
  ) : event.coord ? (
    // Off-campus venue: open it in a map app so the student can
    // navigate there. coord is [lng, lat]; every maps URL wants
    // lat,lng — venueMapUrl does that swap.
    <a
      // The href stays the WEB url so the desktop, a middle-click and
      // "copy link address" all keep working. The tap is intercepted
      // on Capacitor, where a native scheme is what actually reaches
      // the Maps app — see mobile/openVenue.
      href={venueMapUrl(event.coord, venueName ?? '', 'web')}
      target="_blank"
      rel="noopener noreferrer"
      // Tells the global external-link handler to keep its hands off:
      // it runs in the capture phase, so preventing the default below
      // is too late to stop it and the venue opened twice. See
      // `externalHrefFromClick`.
      data-native-open="true"
      onClick={(e) => {
        if (getPlatform().kind !== 'capacitor') return;
        e.preventDefault();
        // The default is already suppressed, so a rejection here — a
        // failed lazy `@capacitor/core` import is the realistic one —
        // would leave the tap doing nothing at all. Fall back to the
        // web URL, which is what the anchor would have done.
        void openVenue(event.coord as [number, number], venueName ?? '').catch((err) => {
          logError('EventDetailCard.openVenue', err);
          void openExternal(venueMapUrl(event.coord!, venueName ?? '', 'web'));
        });
      }}
      className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <MapPin size={13} className="shrink-0" /> {venueName ?? t('map.openInMaps')}
      {/* Navigation, not ExternalLink. The ↗ is the app's mark for
          "this leaves for a web page", and it was promising exactly
          the wrong thing on the one control whose job is to start a
          journey. */}
      <Navigation size={11} className="shrink-0 opacity-60" />
    </a>
  ) : venueName ? (
    // A name and nothing to open it with. Not reachable from the
    // composer (it will not publish without a coordinate) but rows
    // predating that rule exist.
    <div className="flex items-center gap-1.5 text-sm text-base-content/70">
      <MapPin size={13} className="shrink-0" /> {venueName}
    </div>
  ) : event.venueKind === 'tba' ? (
    // Imported from a semester list: the society has not said where yet.
    // Muted and inert, because there is nowhere to go.
    <div className="flex items-center gap-1.5 text-sm text-base-content/60">
      <MapPin size={13} className="shrink-0 opacity-60" />
      {t('map.venueTba', { name: societyShortName })}
    </div>
  ) : null;
}
