import type { MapEvent } from '../../types/events';

// One map balloon = all events sharing a venue coordinate. The soonest event
// supplies the balloon's society colour/glyph; `events` carries the rest for the
// count badge and "also here" detail.
export interface VenueGroup {
  key: string;
  coord: [number, number];
  events: MapEvent[];
}

export function parseEventDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

// Soonest first, by ISO date then time.
export function sortByDate(events: MapEvent[]): MapEvent[] {
  return [...events].sort((a, b) =>
    a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date.localeCompare(b.date)
  );
}

// Only pinnable (on-campus) events become balloons; off-campus events are
// list-only. Grouping key is the rounded coord so co-located events share a pin.
export function groupEventsByVenue(events: MapEvent[]): VenueGroup[] {
  const groups = new Map<string, VenueGroup>();
  for (const e of events) {
    if (!e.coord) continue;
    const key = `${e.coord[0].toFixed(5)},${e.coord[1].toFixed(5)}`;
    const g = groups.get(key);
    if (g) g.events.push(e);
    else groups.set(key, { key, coord: e.coord, events: [e] });
  }
  for (const g of groups.values()) g.events = sortByDate(g.events);
  return [...groups.values()];
}

// The panel sections into three buckets — far easier to grasp than a date
// ("it's on Thursday" beats "it's on the 9th"). `key` is a translation key the
// panel maps to a localized heading. `mapEvents` now holds the whole upcoming
// semester (not just the next two weeks), so anything 14 days out or beyond
// falls under a third "later" bucket instead of endlessly growing "Next week".
export type WeekSectionKey = 'thisWeek' | 'nextWeek' | 'later';
export interface WeekSection {
  key: WeekSectionKey;
  events: MapEvent[];
}

// 00:00 today, in local time.
function startOfDay(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Rolling window from today: "this week" = the next 7 days, "next week" = days
// 7–13, "later" = everything from day 14 on. We intentionally do NOT bucket by
// the calendar (Mon–Sun) — a calendar boundary lets "tomorrow" fall into the
// next bucket on weekends, so a row could read "Tomorrow" under a "Next week"
// heading. A rolling window keeps the label (relativeDayLabel) and the section
// perfectly in sync, and each weekday appears once in the first window so a
// bare weekday is unambiguous.
export function weekSections(events: MapEvent[], now: Date = new Date()): WeekSection[] {
  const day0 = startOfDay(now).getTime();
  const bucketOf = (e: MapEvent): WeekSectionKey => {
    const t = parseEventDate(e.date).getTime();
    if (t < day0 + 7 * 86400_000) return 'thisWeek';
    if (t < day0 + 14 * 86400_000) return 'nextWeek';
    return 'later';
  };

  const buckets = new Map<WeekSectionKey, MapEvent[]>();
  for (const e of sortByDate(events)) {
    const k = bucketOf(e);
    const arr = buckets.get(k);
    if (arr) arr.push(e);
    else buckets.set(k, [e]);
  }
  const order: WeekSectionKey[] = ['thisWeek', 'nextWeek', 'later'];
  return order.filter((k) => buckets.has(k)).map((k) => ({ key: k, events: buckets.get(k)! }));
}

// Human day label for a row. "Today" / "Tomorrow" for the next two days; a bare
// weekday ("Thursday") for the rest of the rolling this-week window (each weekday
// is unique within 7 days, so it's unambiguous). Beyond that — the "Next week"
// bucket — a bare weekday WOULD be ambiguous, so it gets an explicit date too:
// "13. 1. (Tuesday)". Boundary matches weekSections exactly (day 7). Beyond
// day 14 — the "Later" bucket, which can span months — even the weekday +
// short date pair needs the locale's own ordering (see below).
export function relativeDayLabel(
  iso: string,
  locale: string,
  t: (key: string) => string,
  now: Date = new Date()
): string {
  const date = parseEventDate(iso);
  const days = Math.round((date.getTime() - startOfDay(now).getTime()) / 86400_000);
  if (days === 0) return t('map.today');
  if (days === 1) return t('map.tomorrow');

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const weekday = cap(date.toLocaleDateString(locale, { weekday: 'long' }));
  if (days < 7) return weekday; // this-week window — weekday is enough
  // Beyond two weeks a weekday alone says nothing; the locale orders the parts
  // ("Čt 19. 11." in Czech, "Thu, 11/19" in English for the Erasmus students).
  if (days >= 14) {
    return cap(date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }));
  }
  const dm = date.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
  return `${dm} (${weekday})`;
}
