import { useState } from 'react';
import { Camera, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useVisibleMapEvents } from '../../hooks/useVisibleMapEvents';
import { pragueClock, venueStatus } from '../../utils/venues/venueStatus';
import { sortByDate } from './eventHelpers';
import { isFinishedEvent } from './eventWindow';
import { EventRow } from './EventRow';
import type { Venue } from '../../types/campusMap';

const price = (p: number | string) => `${p} Kč`;

/**
 * The part of a society pin card that only a permanent venue has (S-klub's
 * café): open now or not, the lunch offer, the drinks menu one category at a
 * time, the society's upcoming events, and where the prices come from. Shared
 * by the desktop panel, the phone's sheet and the tablet's rail, through
 * SocietyPinCard.
 */
export function VenueDetails({ venue, societyId }: { venue: Venue; societyId: string }) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cz';
  const locale = lang === 'en' ? 'en-US' : 'cs-CZ';
  const now = useAppStore((s) => s.now);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const allEvents = useVisibleMapEvents();
  const [section, setSection] = useState<string | null>(null);

  const status = venueStatus(venue.hours, now);
  const events = sortByDate(
    allEvents.filter((e) => e.societyId === societyId && !isFinishedEvent(e, now))
  ).slice(0, 3);
  const open = venue.menu.find((m) => m.id === section) ?? null;
  const hm = (time: string) => time.replace(/^0(\d)/, '$1');
  const opensLabel = (day: number, time: string) => {
    const today = pragueClock(now).day;
    if (day === today) return t('map.venueOpensToday', { time: hm(time) });
    if (day === (today % 7) + 1) return t('map.venueOpensTomorrow', { time: hm(time) });
    return t('map.venueOpensOn', { day: t(`map.venueOnDay${day}`), time: hm(time) });
  };

  return (
    <div className="space-y-3" data-testid="venue-details">
      <div>
        <p className="text-xs text-base-content/70">
          {venue.kind[lang]} · {venue.where[lang]}
        </p>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-base-content">
          {/* The dot carries the colour; the words stay readable in both themes. */}
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${status.open ? 'bg-success' : 'bg-error'}`}
          />
          {status.open
            ? t('map.venueOpenUntil', { time: hm(status.closes) })
            : status.opens
              ? `${t('map.venueClosed')} · ${opensLabel(status.day!, status.opens)}`
              : t('map.venueClosed')}
        </p>
      </div>

      {venue.lunch && (
        <div className="flex items-baseline justify-between gap-3 rounded-lg bg-base-200/70 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-base-content/60">
              {t('map.venueLunch')}
            </p>
            <p className="text-sm text-base-content">{venue.lunch.name[lang]}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold">{price(venue.lunch.price)}</span>
        </div>
      )}

      <div>
        <p className="pb-1.5 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
          {t('map.venueMenu')}
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('map.venueMenu')}>
          {venue.menu.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === section}
              onClick={() => setSection(m.id === section ? null : m.id)}
              className={`btn btn-xs rounded-full ${m.id === section ? 'btn-primary' : 'btn-outline border-base-300'}`}
            >
              {m.title[lang]}
            </button>
          ))}
        </div>
        {open && (
          <ul className="mt-2 divide-y divide-base-300/70 rounded-lg border border-base-300 px-3">
            {open.items.map((item) => (
              <li key={item.name} className="flex justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 break-words">{item.name}</span>
                <span className="shrink-0 tabular-nums text-base-content/80">
                  {price(item.price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {events.length > 0 && (
        <div>
          <p className="pb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
            {t('map.venueEvents')}
          </p>
          <div className="-mx-3">
            {events.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                locale={locale}
                t={t}
                selected={false}
                onClick={() => focusEvent(e.id, { fly: true })}
              />
            ))}
          </div>
        </div>
      )}

      {venue.instagram && (
        <a
          href={`https://www.instagram.com/${venue.instagram}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm btn-block border-base-300"
        >
          <Camera size={14} /> Instagram <ExternalLink size={13} />
        </a>
      )}

      <p className="text-[11px] text-base-content/60">
        {t('map.venueSource', {
          site: new URL(venue.source.url).hostname,
          date: new Date(`${venue.source.checked}T12:00:00`).toLocaleDateString(locale),
        })}
      </p>
    </div>
  );
}
