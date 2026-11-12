import type { Venue, VenueMenuItem } from '../../types/campusMap';
import { groupHours, shortTime, type VenueStatus } from './venueStatus';

type T = (key: string, params?: Record<string, string | number>) => string;

/** Every number in a price: 89 → [89], '45/55' → [45, 55]. */
function prices(price: VenueMenuItem['price']): number[] {
  if (typeof price === 'number') return [price];
  return (price.match(/\d+/g) ?? []).map(Number);
}

/** '35–65 Kč', or '119 Kč' when every item costs the same. */
export function priceRange(items: VenueMenuItem[]): string {
  const all = items.flatMap((i) => prices(i.price));
  if (all.length === 0) return '';
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return lo === hi ? `${lo} Kč` : `${lo}–${hi} Kč`;
}

export const formatPrice = (price: VenueMenuItem['price']) =>
  typeof price === 'number' ? `${price} Kč` : `${price.replace('/', ' / ')} Kč`;

/** 'Po–Pá 8:00–18:00', groups joined by ', '. */
export function hoursSummary(hours: Venue['hours'], t: T): string {
  return groupHours(hours)
    .map((g) => {
      const days =
        g.from === g.to
          ? t(`map.venueDayShort${g.from}`)
          : `${t(`map.venueDayShort${g.from}`)}–${t(`map.venueDayShort${g.to}`)}`;
      return `${days} ${shortTime(g.open)}–${shortTime(g.close)}`;
    })
    .join(', ');
}

/** '16. 11.' / '11/16' — a short day and month for the student's language. */
export function shortDate(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The words after the status pill: 'dnes do 18:00', 'otevírá zítra v 8:00',
 * 'otevírá v pondělí v 8:00', or a date a week or more away.
 */
export function whenLine(status: VenueStatus, t: T, locale: string): string {
  if (status.open) return t('map.venueUntilToday', { time: shortTime(status.closes) });
  if (status.opens === null || status.inDays === null) return '';
  const time = shortTime(status.opens);
  if (status.inDays === 0) return t('map.venueOpensToday', { time });
  if (status.inDays === 1) return t('map.venueOpensTomorrow', { time });
  if (status.inDays < 7)
    return t('map.venueOpensOn', { day: t(`map.venueOnDay${status.day}`), time });
  return t('map.venueOpensDate', { date: shortDate(status.date!, locale), time });
}
