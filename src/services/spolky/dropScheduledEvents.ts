import { isBeyondSoon } from '../../components/CampusMap/eventWindow';
import type { SpolekNotification } from './types';

/**
 * Drops society events that start beyond Novinky's own soon horizon.
 *
 * The 14-day cutoff is no longer "goes live" — the server query now bounds
 * the feed to the same soon horizon itself (`SOON_WINDOW_DAYS`, see
 * `fetchNotifications`), so a fresh fetch never carries a day-14+ row. The
 * cached list in IndexedDB is written once and never re-examined though, so a
 * row that was inside the horizon when cached drifts outside it as days pass.
 * This is the same window, asked at read time like `dropPastEvents`, so the
 * cached list is held to it as well as a fresh fetch.
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
    return !isBeyondSoon(day, now);
  });
}
