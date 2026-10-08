import { z } from 'zod';
import type { SpolekNotification } from './types';
import { supabase } from './supabaseClient';
import { logError } from '../../utils/reportError';
import { hasDataConsent } from '../../utils/firefoxDataConsent';
import { localTodayIso, NOVINKY_WINDOW_DAYS } from '../../components/CampusMap/eventWindow';

// Runtime shape of a `spolky_events` row used by the notification feed. Supabase
// results are `any`-typed, so we validate before rendering user-facing content
// rather than trusting the DB.
const NotificationRowSchema = z.object({
  id: z.string(),
  association_id: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  url: z.string().nullable(),
  created_at: z.string(),
  date: z.string(),
  end_date: z.string().nullable(),
  subscribers_only: z.boolean().nullable().optional(),
});

/**
 * Track that notifications were viewed (when bell icon opened)
 * @param notificationIds - IDs of notifications that were viewed
 */
export async function trackNotificationsViewed(notificationIds: string[]): Promise<void> {
  if (!notificationIds || notificationIds.length === 0) return;
  // A post id is no identifier, but a view count is interaction data to
  // Mozilla, and opening the feed works without it — Firefox's toggle decides.
  if (!(await hasDataConsent('technicalAndInteraction'))) return;

  try {
    // Call Supabase RPC to increment view counts for each notification
    // We use Promise.all to run them in parallel
    await Promise.all(
      notificationIds.map((id) => supabase.rpc('increment_post_view', { row_id: id }))
    );
  } catch (error) {
    logError('Spolky.trackNotificationsViewed', error);
  }
}

/**
 * Track that a notification was clicked
 * @param notificationId - ID of the notification that was clicked
 */
export async function trackNotificationClick(notificationId: string): Promise<void> {
  if (!notificationId) return;
  if (!(await hasDataConsent('technicalAndInteraction'))) return;

  try {
    await supabase.rpc('increment_post_click', { row_id: notificationId });
  } catch (error) {
    logError('Spolky.trackNotificationClick', error);
  }
}

/**
 * Fetch all active notifications from Supabase
 */
/**
 * The upcoming society events, or `null` when the answer is not known.
 *
 * The distinction is load-bearing and used to be missing. Every failure —
 * a Supabase error, a row the schema rejects, a thrown exception — returned
 * `[]`, which is also what a student with no upcoming events legitimately
 * gets. The caller could not tell them apart, so it recorded a transient
 * network blip as a successful empty feed and wrote that over the cache: one
 * failed request and the student's Novinky were gone until the next fetch
 * succeeded. `null` is "ask again later"; `[]` is "there is nothing on".
 */
export async function fetchNotifications(): Promise<SpolekNotification[] | null> {
  try {
    // Bounded to the Novinky week on the SERVER: the limit is applied before the
    // device applies the audience rule (which never leaves the device), so an
    // unbounded list of whole imported semesters would push a small society's
    // next event off the end. A trip still running (end_date >= today) stays.
    const today = localTodayIso();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + NOVINKY_WINDOW_DAYS - 1);
    const now = new Date().toISOString();
    // ONE .or() with nested and(): whether PostgREST ANDs two separate `or`
    // params was not verified, so the whole condition is written unambiguously.
    const visible = `or(visible_from.is.null,visible_from.lte.${now})`;
    const { data, error } = await supabase
      .from('spolky_events')
      .select('id, association_id, title, body, url, created_at, date, end_date, subscribers_only')
      .lte('date', localTodayIso(horizon))
      .or(`and(date.gte.${today},${visible}),and(end_date.gte.${today},${visible})`)
      .order('date', { ascending: true })
      .limit(200);

    if (error) {
      logError('Spolky.fetchNotifications', error);
      return null;
    }

    const parsed = z.array(NotificationRowSchema).safeParse(data ?? []);
    if (!parsed.success) {
      logError('Spolky.fetchNotifications', parsed.error);
      return null;
    }

    return parsed.data.map((n) => ({
      id: n.id,
      associationId: n.association_id,
      title: n.title,
      body: n.body || n.title,
      link: n.url || undefined,
      createdAt: n.created_at,
      expiresAt: n.end_date || n.date, // events use their date as natural expiry
      startsAt: n.date, // decides go-live, see dropScheduledEvents
      priority: 'normal' as const,
      subscribersOnly: n.subscribers_only ?? false,
    }));
  } catch (err) {
    logError('Spolky.fetchNotifications', err);
    return null;
  }
}

/**
 * Drops society events that are over.
 *
 * The server query already asks for `date >= today`, so a fresh fetch never
 * carries a past event. The feed is also served from `notifications_cache` in
 * IndexedDB though — written whenever a fetch lands, and never re-examined —
 * so an event that was current when the cache was written stayed in the list,
 * unread and highlighted, long after it happened: "deskovky notification still
 * shows and highlights even a day after they happened". Asking the question at
 * READ time is what makes the answer independent of where the list came from,
 * and of how long the app has been open.
 *
 * Judged on `expiresAt`, which is `end_date || date`, so a multi-day event is
 * judged on its end. Day granularity: the rows carry no time, and an event at
 * 19:00 is still news at 09:00 the same day.
 *
 * `todayIso` is the student's LOCAL day, deliberately. The server builds its
 * filter from `new Date().toISOString()`, which is UTC — between local midnight
 * and 02:00 CEST that is still yesterday, so even a fresh fetch keeps a
 * finished event for a couple of hours. The client is where the student is.
 *
 * Anything undateable is KEPT. Hiding a society's announcement because a field
 * could not be parsed is a worse failure than showing a stale one.
 */
export function dropPastEvents(
  notifications: SpolekNotification[],
  todayIso: string
): SpolekNotification[] {
  return notifications.filter((n) => {
    const day = (n.expiresAt ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
    // ISO dates compare lexicographically, which for YYYY-MM-DD is chronological.
    return day >= todayIso;
  });
}

/**
 * Drops society rows cached by a build before the audience rule (5.3.0 and
 * older). Their rows carry no `subscribersOnly`, which would read as public and
 * put ESN's Erasmus-only events in every student's Novinky until the first
 * fetch lands — or for the whole session, offline. Only an old build writes a
 * society row without the key; reIS's own rows (no society) stay.
 */
export function dropPreAudienceRows(notifications: SpolekNotification[]): SpolekNotification[] {
  return notifications.filter(
    (n) =>
      !n.associationId ||
      n.associationId === 'admin' ||
      n.associationId.startsWith('academic_') ||
      'subscribersOnly' in n
  );
}

/**
 * Drops rows beyond the Novinky week. The server query is bounded the same way,
 * but the feed is also served from `notifications_cache`, which a build with a
 * 14-day window may have written — asking at READ time makes the answer
 * independent of where the list came from. Undated rows (academic) stay.
 */
export function dropBeyondNovinkyWindow(
  notifications: SpolekNotification[],
  todayIso: string
): SpolekNotification[] {
  const last = new Date(`${todayIso}T00:00:00`);
  last.setDate(last.getDate() + NOVINKY_WINDOW_DAYS - 1);
  const lastIso = localTodayIso(last);
  return notifications.filter((n) => !n.startsAt || n.startsAt.slice(0, 10) <= lastIso);
}
