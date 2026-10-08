import { validateExternalUrl } from '../../mobile/openExternal';
import { isInstagramHandle } from '../../utils/societies/instagramHandle';
import type { MapEvent, Society } from '../../types/events';

/**
 * Where "details" goes: the event's own link when it has a safe one, otherwise
 * the society's Instagram — for an event imported from a semester poster, that
 * is where the time and place get announced. The handle is re-checked here
 * because it is data from Supabase, not something the app typed.
 */
export function eventDetailsLink(
  event: Pick<MapEvent, 'url'>,
  society: Pick<Society, 'instagram'>
): { href: string; kind: 'event' | 'instagram' } | null {
  if (event.url && validateExternalUrl(event.url)) return { href: event.url, kind: 'event' };
  if (society.instagram && isInstagramHandle(society.instagram))
    return { href: `https://www.instagram.com/${society.instagram}/`, kind: 'instagram' };
  return null;
}

/**
 * Whether the detail card would tell the student anything the list row does
 * not: the row already shows the title, the date and a named place. A span is
 * a detail: an upcoming trip's row shows only its first day.
 */
export function eventHasDetails(
  event: Pick<
    MapEvent,
    'date' | 'endDate' | 'description' | 'time' | 'location' | 'coord' | 'roomCode' | 'venueKind'
  >
): boolean {
  return (
    (!!event.endDate && event.endDate > event.date) ||
    !!event.description?.trim() ||
    !!event.time?.trim() ||
    !!event.location?.trim() ||
    !!event.coord ||
    !!event.roomCode ||
    event.venueKind !== 'tba'
  );
}

/**
 * Where tapping the event goes INSTEAD of its card, or null to open the card.
 * An event with no details had a card that repeated the row and held one
 * button, so the tap goes to that button's link (spec 2026-10-08). With no
 * link either, the card stays: a tap must still go somewhere.
 */
export function eventDirectLink(
  event: Pick<
    MapEvent,
    | 'url'
    | 'date'
    | 'endDate'
    | 'description'
    | 'time'
    | 'location'
    | 'coord'
    | 'roomCode'
    | 'venueKind'
  >,
  society: Pick<Society, 'instagram'>
): { href: string; kind: 'event' | 'instagram' } | null {
  return eventHasDetails(event) ? null : eventDetailsLink(event, society);
}
