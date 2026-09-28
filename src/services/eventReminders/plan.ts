import type { MapEvent } from '../../types/events';
import type { RsvpStatus } from '../../api/eventRsvp';
import { isFinishedEvent } from '../../components/CampusMap/eventWindow';
import { digestText } from './digestText';

/** Two hours, not one: an hour's notice isn't enough to cross Brno and change,
 *  so a reminder that late is an apology rather than a use. */
export const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;

export interface PlannedReminder {
  /** Stable per event, so rescheduling replaces a reminder instead of adding one. */
  id: number;
  eventId: string;
  title: string;
  body: string;
  /** Epoch ms at which the notification should fire. */
  at: number;
}

/** Capacitor's LocalNotifications ids are 32-bit signed ints; an event id is a
 *  uuid. FNV-1a, masked positive, stays stable across launches and can't
 *  overflow into a collision that silently merges two events into one. */
export function reminderId(eventId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < eventId.length; i++) {
    h ^= eventId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 1 keeps it positive and inside 2^31 - 1; | 1 keeps it away from 0,
  // which the plugin treats as "no id".
  return ((h >>> 1) | 1) >>> 0;
}

/** When an event actually starts, in local time. Null rather than a guess when
 *  there's no usable time — an all-day entry has no "two hours before". */
export function eventStartsAt(event: MapEvent): number | null {
  if (!event.time) return null;
  // IS and the composer both emit HH:MM, but dotted "19.30" turns up in
  // scraped rows, so both separators are accepted.
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(event.time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  // The regex shape allows "25:70"; the Date constructor would happily roll
  // that into the next day rather than reject it, and the student would be
  // pinged at a time no one chose.
  if (hour > 23 || minute > 59) return null;

  // The shape is checked before the parts are read: `split('-')` ignores
  // trailing fields, so "2026-09-10-extra" would yield a perfectly valid
  // 2026-09-10 and pass the round-trip check below.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return null;

  // Constructed from parts rather than parsed from a string: `new Date('...')`
  // treats a bare date as UTC and a date+time as local, which would shift
  // every reminder by the timezone offset.
  const [y, mo, d] = event.date.split('-').map(Number);
  if (!y || !mo || !d) return null;
  const start = new Date(y, mo - 1, d, hour, minute, 0, 0);
  const at = start.getTime();
  if (!Number.isFinite(at)) return null;
  // Same normalisation trap on the date half: "2026-02-30" becomes 2 March.
  // Reading the components back is the only way to tell a real date from one
  // the constructor quietly moved.
  if (start.getFullYear() !== y || start.getMonth() !== mo - 1 || start.getDate() !== d) {
    return null;
  }
  return at;
}

/** Tags which channel and cancellation set a notification belongs to. */
export interface PlannedNotification extends PlannedReminder {
  kind: 'rsvp' | 'digest';
  channelId: string;
}

export interface PlanInput {
  events: MapEvent[];
  rsvp: Record<string, RsvpStatus>;
  followed: string[];
  muted: string[];
  prefs: { myEvents: boolean; followedEvents: boolean; newEvents: boolean };
  shortName: (societyId: string) => string;
}

/** Localised digest strings, passed in so `planNotifications` stays pure. */
export interface DigestLabels {
  tomorrow: (titles: string) => string;
  tomorrowMany: (n: number, titles: string) => string;
  newOnly: (titles: string) => string;
  plusNew: (n: number, societies: string) => string;
  leadLabel: string;
}

/** Android channel: "Připomínky akcí" / "Event reminders". */
export const CHANNEL_RSVP = 'reis-event-reminders';
/** Android channel: "Akce spolků" / "Society events". */
export const CHANNEL_DIGEST = 'reis-society-digest';

/** The digest fires at this local hour, every evening. */
export const DIGEST_HOUR = 18;
/** How many days ahead the digest plans for. */
export const DIGEST_DAYS = 14;
/** The plugin's queue is bounded; beyond this, oldest-firing entries drop
 *  rather than the device silently overflowing. */
export const MAX_PENDING = 50;

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 1) | 1) >>> 0;
}

// `reminderId` stays exactly as it is — those ids are already pending on
// devices and must keep reconciling — so digests get their own FNV call.
export const digestId = (dayIso: string) => fnv(`digest:${dayIso}`);

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Local 18:00, `offset` calendar days after `now`'s day. setDate, not
// +86400000: a fixed-ms step lands on 17:00 or 19:00 across a clock change.
function digestAt(now: number, offset: number): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  d.setHours(DIGEST_HOUR, 0, 0, 0);
  return d;
}

/**
 * Every local notification that should exist right now: RSVP pings (two hours
 * before anything the student said they'd go to; past warnings are skipped as
 * noise, not notice) plus one evening digest per day, for the next two weeks,
 * for societies the student follows and hasn't muted. Pure and total — no
 * permissions, no plugin, so both rules are testable without a device.
 */
export function planNotifications(
  input: PlanInput,
  now: number,
  labels: DigestLabels
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const listens = (e: MapEvent) =>
    input.followed.includes(e.societyId) && !input.muted.includes(e.societyId);

  if (input.prefs.myEvents) {
    for (const e of input.events) {
      // Interested counts as well as Going: both are the student asking to
      // hear about it, and only one of them is a commitment.
      if (!input.rsvp[e.id]) continue;
      const starts = eventStartsAt(e);
      if (starts === null) continue;
      const at = starts - REMINDER_LEAD_MS;
      if (at <= now) continue;
      out.push({
        kind: 'rsvp',
        channelId: CHANNEL_RSVP,
        id: reminderId(e.id),
        eventId: e.id,
        title: e.title,
        body: [labels.leadLabel, e.location].filter(Boolean).join(' · '),
        at,
      });
    }
  }

  if (input.prefs.followedEvents || input.prefs.newEvents) {
    const mine = input.events.filter(listens);
    for (let offset = 0; offset < DIGEST_DAYS; offset++) {
      const fire = digestAt(now, offset);
      if (fire.getTime() <= now) continue;
      const tomorrowIso = isoOf(new Date(fire.getFullYear(), fire.getMonth(), fire.getDate() + 1));
      const windowStart = digestAt(now, offset - 1).getTime();
      const tomorrow = input.prefs.followedEvents
        ? mine.filter((e) => e.date === tomorrowIso && !isFinishedEvent(e, fire))
        : [];
      const fresh = input.prefs.newEvents
        ? mine.filter((e) => {
            const c = e.createdAt ? Date.parse(e.createdAt) : NaN;
            return c > windowStart && c <= fire.getTime();
          })
        : [];
      const text = digestText(tomorrow, fresh, input.shortName, labels);
      if (!text) continue;
      out.push({
        kind: 'digest',
        channelId: CHANNEL_DIGEST,
        id: digestId(isoOf(fire)),
        eventId: '',
        title: text.title,
        body: text.body,
        at: fire.getTime(),
      });
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, MAX_PENDING);
}

/** @deprecated Temporary shim so `createRsvpSlice` keeps compiling until it
 *  moves onto `planNotifications` directly; delete with that migration. */
export const planReminders = (
  events: MapEvent[],
  answered: Record<string, RsvpStatus>,
  now: number,
  leadLabel = ''
): PlannedReminder[] =>
  planNotifications(
    {
      events,
      rsvp: answered,
      followed: [],
      muted: [],
      prefs: { myEvents: true, followedEvents: false, newEvents: false },
      shortName: () => '',
    },
    now,
    { tomorrow: () => '', tomorrowMany: () => '', newOnly: () => '', plusNew: () => '', leadLabel }
  );
