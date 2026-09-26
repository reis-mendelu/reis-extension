import { isScheduledEvent } from '../../components/CampusMap/eventWindow';
import type { SpolekNotification } from './types';

/**
 * Drops society events that have not gone live yet.
 *
 * The console files an event 14+ days out under "Naplánované — zveřejní se
 * <date>" and the map hides it until then (`isPublicEvent` in `mapEvents.ts`).
 * Novinky did not: the server query asks only for `date >= today`, and
 * `visible_from` is null on every row, so a subscriber saw the event — and it
 * counted views and clicks the society is shown — from the moment it was
 * published. This is the same window, asked at read time like `dropPastEvents`,
 * so the cached list is held to it as well as a fresh fetch.
 *
 * Judged on `startsAt` (the row's `date`), as the map judges it, so a multi-day
 * event goes live by its start. Local day, via `eventWindow`, so Novinky and the
 * console's "zveřejní se" date agree after midnight too — which a server filter
 * built from `toISOString()` (UTC) would not.
 *
 * A row without a readable start is KEPT: academic rows have none, and caches
 * written before the field existed are refilled by the next fetch.
 */
export function dropScheduledEvents(
  notifications: SpolekNotification[],
  now: Date = new Date()
): SpolekNotification[] {
  return notifications.filter((n) => {
    const day = n.startsAt ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
    return !isScheduledEvent(day, now);
  });
}
