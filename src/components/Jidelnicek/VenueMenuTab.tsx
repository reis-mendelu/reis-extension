import { ChevronRight, Utensils } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useSociety } from '../../hooks/useSociety';
import { SocietyLogo } from '../SocietyLogo';
import { floorText } from '../CampusMap/floorText';
import { pragueClock, venueStatus } from '../../utils/venues/venueStatus';
import { formatPrice, hoursSummary, whenLine } from '../../utils/venues/venueText';
import { venueFloorLevel } from '../../utils/venues/venueFloor';
import { venueLunchDays } from '../../utils/venues/venueLunchDays';
import type { SocietyPin, Venue } from '../../types/campusMap';

/**
 * A venue (S-klub) as a tab of the Jídelníček, on both trees — mockup "reIS
 * venues S-klub Pixie", page 4 (phone/iPad sheet) and page 6 (the extension's
 * popover). The lunch offer with that day's dishes when reIS has them, where it
 * is and whether it is open, and a way to the venue's card on the map for the
 * whole menu with prices. The card itself stays on the map: the Jídelníček is
 * about lunch.
 *
 * "Open" is about now, so it is said only on today's tab; another day of the
 * week gets the hours.
 */
export function VenueMenuTab({
  pin,
  venue,
  dayIso,
  variant,
  onOpenMap,
}: {
  pin: SocietyPin;
  venue: Venue;
  dayIso: string;
  variant: 'sheet' | 'popover';
  onOpenMap: () => void;
}) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cz';
  const now = useAppStore((s) => s.now);
  const society = useSociety(pin.societyId);
  const sheet = variant === 'sheet';
  const lunch = venue.lunch;
  const scraped = useAppStore((s) => s.sklubMenu);
  const day = venueLunchDays(pin, scraped).find((d) => d.date === dayIso);
  const level = venueFloorLevel(venue.roomCode);
  const place = [venue.place[lang], level === null ? null : floorText(level, t)]
    .filter(Boolean)
    .join(', ');
  const today = pragueClock(now).date === dayIso;
  const status = venueStatus(venue.hours, now, venue.closure);
  const detail = today && !sheet ? whenLine(status, t, lang === 'en' ? 'en-GB' : 'cs-CZ') : '';
  const hours = sheet || !today ? hoursSummary(venue.hours, t) : '';

  const row = sheet
    ? 'rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5'
    : 'rounded-lg border border-base-300 px-3 py-2';
  const text = sheet ? 'text-md' : 'text-xs';

  const statusWords = today && (
    <span className="inline-flex items-center gap-1.5 font-semibold text-base-content">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${status.open ? 'bg-success' : 'bg-base-content/40'}`}
      />
      {status.open ? t('map.venueOpen') : t('map.venueClosed')}
    </span>
  );
  const after = [detail, hours].filter(Boolean).join(' · ');

  return (
    <div data-testid="menu-venue" className={`flex flex-col ${sheet ? 'gap-2' : 'gap-2 p-3'}`}>
      {lunch && (
        <div className={row}>
          <div className="flex items-center gap-2.5">
            <Utensils
              size={sheet ? 16 : 14}
              className="flex-shrink-0 text-base-content/40"
              aria-hidden
            />
            <span className={`min-w-0 flex-1 text-base-content ${text}`}>{lunch.name[lang]}</span>
            <span className={`flex-shrink-0 font-bold tabular-nums text-base-content ${text}`}>
              {formatPrice(lunch.price)}
            </span>
          </div>
          {day && (
            // The day's dishes, as S-klub publishes them (Czech only), scraped
            // on the device like SKM's (createSklubMenuSlice).
            <ul
              className={`mt-2 space-y-1 border-t border-base-300 pt-2 text-base-content ${sheet ? 'text-sm' : 'text-xs'}`}
            >
              {day.dishes.map((d) => (
                <li key={d} className="break-words">
                  {d}
                </li>
              ))}
              {day.soup && (
                <li className="break-words text-base-content/70">
                  {t('map.venueSoup')}: {day.soup}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {sheet ? (
        <div className={`flex items-center gap-3 ${row}`}>
          {society && (
            <SocietyLogo
              society={society}
              fit="contain"
              className="h-10 w-10 rounded-lg bg-white text-xs ring-1 ring-base-300"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-md font-bold text-base-content">{place}</p>
            {/* Plain text flow: at 320px the hours wrap under "Otevřeno ·"
                rather than starting their own line with the dot. */}
            <p className="text-sm text-base-content/70">
              {statusWords && (
                <span className="whitespace-nowrap">
                  {statusWords}
                  {after ? ' ·' : ''}
                </span>
              )}
              {statusWords && after ? ' ' : ''}
              {/* Each hours group whole: an en dash is a break opportunity,
                  and 320px broke "8:00–18:00" in two. */}
              {after.split(', ').map((part, i) => (
                <span key={part} className="whitespace-nowrap">
                  {i > 0 ? `, ${part}` : part}
                </span>
              ))}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-0.5 text-xs text-base-content/70">
          {society && (
            <SocietyLogo
              society={society}
              fit="contain"
              className="h-6 w-6 rounded-md bg-white text-[9px] ring-1 ring-base-300"
            />
          )}
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
            <span>{place}</span>
            {(statusWords || after) && <span aria-hidden="true">·</span>}
            {statusWords}
            {after && <span>{after}</span>}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onOpenMap}
        className={`btn btn-outline w-full flex-nowrap gap-1 border-base-300 ${sheet ? 'min-h-11' : 'btn-sm text-xs'}`}
      >
        {sheet ? t('menu.venueFullMenu') : t('menu.venueFullMenuOnMap')}
        <ChevronRight size={sheet ? 16 : 14} aria-hidden />
      </button>
    </div>
  );
}
