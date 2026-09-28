import { validateExternalUrl } from '../../mobile/openExternal';
import type { MapEvent, Society } from '../../types/events';

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

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
  if (society.instagram && HANDLE_RE.test(society.instagram))
    return { href: `https://www.instagram.com/${society.instagram}/`, kind: 'instagram' };
  return null;
}
