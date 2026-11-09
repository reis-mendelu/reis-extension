import { ChevronRight, Utensils } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useVisibleMapEvents } from '../../hooks/useVisibleMapEvents';
import { pragueClock, venueStatus } from '../../utils/venues/venueStatus';
import { formatPrice } from '../../utils/venues/venueText';
import { sortByDate } from './eventHelpers';
import { isFinishedEvent } from './eventWindow';
import type { Venue } from '../../types/campusMap';

const heading = 'pb-1.5 text-sm font-bold text-base-content';

/** Up to three photos in a row; one that fails to load leaves its cell. */
export function VenuePhotos({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="venue-photos">
      {photos.slice(0, 3).map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className="aspect-[4/3] w-full rounded-xl bg-base-200 object-cover"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ))}
    </div>
  );
}

/**
 * The lunch offer. "Dnes k obědu" on a day the venue opens, with the day's
 * soup and dishes when reIS has filled in the week (`lunch_week`); otherwise
 * the standing offer as the venue states it.
 */
export function VenueLunch({ venue, now }: { venue: Venue; now: Date }) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cz';
  if (!venue.lunch) return null;
  const status = venueStatus(venue.hours, now, venue.closure);
  const servesToday = status.open || status.inDays === 0;
  const today = venue.lunchDays.find((d) => d.date === pragueClock(now).date);
  const dishes = servesToday && today ? today : null;
  return (
    <section>
      <h4 className={heading}>{servesToday ? t('map.venueLunchToday') : t('map.venueLunch')}</h4>
      <div className="rounded-xl border border-base-300 px-3 py-2.5" data-testid="venue-lunch">
        <div className="flex items-center gap-3">
          <Utensils size={16} className="shrink-0 text-base-content/60" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-base-content">{venue.lunch.name[lang]}</p>
            {venue.lunch.note && !dishes && (
              <p className="text-xs text-base-content/70">{venue.lunch.note[lang]}</p>
            )}
          </div>
          <span className="shrink-0 font-bold tabular-nums text-base-content">
            {formatPrice(venue.lunch.price)}
          </span>
        </div>
        {dishes && (
          <ul className="mt-2 space-y-1 border-t border-base-300/70 pt-2 text-sm text-base-content/90">
            {dishes.soup && (
              <li>
                <span className="font-semibold">{t('map.venueSoup')}:</span> {dishes.soup}
              </li>
            )}
            {dishes.dishes.map((d) => (
              <li key={d} className="break-words">
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The society's next events (up to 3), as date tiles; a tap opens the event. */
export function VenueEvents({ societyId }: { societyId: string }) {
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-GB' : 'cs-CZ';
  const now = useAppStore((s) => s.now);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const all = useVisibleMapEvents();
  const events = sortByDate(
    all.filter((e) => e.societyId === societyId && !isFinishedEvent(e, now))
  ).slice(0, 3);
  if (events.length === 0) return null;
  return (
    <section>
      <h4 className={heading}>{t('map.venueEvents')}</h4>
      <ul className="space-y-2">
        {events.map((e) => {
          const d = new Date(`${e.date}T12:00:00`);
          const sub = [e.time, e.location?.trim()].filter(Boolean).join(' · ');
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => focusEvent(e.id, { fly: true })}
                className="flex w-full items-center gap-3 rounded-xl border border-base-300 p-2 text-left transition-colors hover:bg-base-200"
              >
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-base-200 leading-none">
                  <span className="text-[10px] font-bold uppercase text-primary">
                    {d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}
                  </span>
                  <span className="text-lg font-bold text-base-content">{d.getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-base-content">
                    {e.title}
                  </span>
                  {sub && (
                    <span className="block truncate text-xs text-base-content/70">{sub}</span>
                  )}
                </span>
                <ChevronRight size={16} className="shrink-0 text-base-content/50" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Ceny podle sklubpixie.cz, ověřeno 8. 11. 2026." — the prices are copied and go stale. */
export function VenueSource({ venue }: { venue: Venue }) {
  const { t, language } = useTranslation();
  if (!venue.source) return null;
  const locale = language === 'en' ? 'en-GB' : 'cs-CZ';
  const site = new URL(venue.source.url).hostname.replace(/^www\./, '');
  return (
    <p className="text-xs text-base-content/70">
      <a href={venue.source.url} target="_blank" rel="noopener noreferrer" className="link">
        {t('map.venueSource', {
          site,
          date: new Date(`${venue.source.checked}T12:00:00Z`).toLocaleDateString(locale, {
            timeZone: 'UTC',
          }),
        })}
      </a>
    </p>
  );
}
