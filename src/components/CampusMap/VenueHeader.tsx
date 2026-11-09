import { Camera, CircleAlert, Navigation } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSociety } from '../../hooks/useSociety';
import { getPlatform } from '../../platform';
import { openVenue } from '../../mobile/openVenue';
import { openExternal } from '../../mobile/openExternal';
import { logError } from '../../utils/reportError';
import { venueMapUrl } from '../../utils/venueMapUrl';
import { closureNotice, venueStatus } from '../../utils/venues/venueStatus';
import { hoursSummary, shortDate, whenLine } from '../../utils/venues/venueText';
import { SocietyLogo } from '../SocietyLogo';
import type { SocietyPin, Venue } from '../../types/campusMap';

/**
 * The top of a venue card: who and where, open or not, a closure notice, and
 * the two ways out — directions in a map app and Instagram.
 */
export function VenueHeader({ pin, venue, now }: { pin: SocietyPin; venue: Venue; now: Date }) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cz';
  const locale = lang === 'en' ? 'en-GB' : 'cs-CZ';
  const soc = useSociety(pin.societyId)!;
  const status = venueStatus(venue.hours, now, venue.closure);
  const notice = closureNotice(venue.closure, now);
  const when = whenLine(status, t, locale);
  const hours = hoursSummary(venue.hours, t);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <SocietyLogo
          society={soc}
          fit="contain"
          className="h-12 w-12 rounded-xl bg-white ring-1 ring-base-300 text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-primary">
            {venue.kind[lang]} · {venue.place[lang]}
          </p>
          <h3 className="truncate text-lg font-bold leading-tight text-base-content">
            {pin.title}
          </h3>
          <p className="truncate text-xs text-base-content/70">{venue.address[lang]}</p>
        </div>
      </div>

      {notice && (
        <div role="status" className="alert alert-warning alert-soft items-start gap-2 px-3 py-2">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">
              {notice.state === 'now'
                ? t('map.venueClosureNow')
                : t('map.venueClosureSoon', { date: shortDate(notice.from, locale) })}
            </p>
            <p>
              {status.open || status.date === null
                ? t('map.venueClosureRangeNoReopen', {
                    from: shortDate(notice.from, locale),
                    until: shortDate(notice.until, locale),
                  })
                : t('map.venueClosureRange', {
                    from: shortDate(notice.from, locale),
                    until: shortDate(notice.until, locale),
                    opens: shortDate(status.date, locale),
                  })}
            </p>
          </div>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/80">
        {/* The colour is on the dot and the pill's tint; the words stay ink. */}
        <span
          data-testid="venue-status"
          className={`badge gap-1.5 border-0 font-semibold text-base-content ${status.open ? 'bg-success/15' : 'bg-base-200'}`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${status.open ? 'bg-success' : 'bg-base-content/40'}`}
          />
          {status.open ? t('map.venueOpen') : t('map.venueClosed')}
        </span>
        <span>{[when, hours].filter(Boolean).join(' · ')}</span>
      </p>

      <div className={`grid gap-2 ${venue.instagram ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <a
          // The web URL in the href keeps the desktop, middle-click and "copy
          // link" working; on Capacitor the tap hands off to a map app instead
          // (mobile/openVenue), as an off-campus event's venue does.
          href={venueMapUrl(pin.coord, pin.title, 'web')}
          target="_blank"
          rel="noopener noreferrer"
          data-native-open="true"
          onClick={(e) => {
            if (getPlatform().kind !== 'capacitor') return;
            e.preventDefault();
            void openVenue(pin.coord, pin.title).catch((err) => {
              logError('VenueHeader.openVenue', err);
              void openExternal(venueMapUrl(pin.coord, pin.title, 'web')).catch((e2) =>
                logError('VenueHeader.openExternal', e2)
              );
            });
          }}
          className="btn btn-primary min-h-11 gap-2"
        >
          <Navigation size={16} aria-hidden /> {t('map.venueRoute')}
        </a>
        {venue.instagram && (
          <a
            href={`https://www.instagram.com/${venue.instagram}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline min-h-11 gap-2 border-base-300"
          >
            <Camera size={16} aria-hidden /> Instagram
          </a>
        )}
      </div>
    </div>
  );
}
