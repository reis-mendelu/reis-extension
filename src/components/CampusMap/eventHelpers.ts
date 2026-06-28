import type { MapEvent, FacultyKey } from '../../types/events';

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
    a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date.localeCompare(b.date),
  );
}

// 'all' → every event. 'faculty' → events whose authoring society belongs to a
// faculty the student follows (ESN's mendelu key is always followed).
export function filterEvents(
  events: MapEvent[],
  filter: 'all' | 'faculty',
  facultyOf: (societyId: string) => FacultyKey,
  subscribed: FacultyKey[],
): MapEvent[] {
  if (filter === 'all') return events;
  return events.filter((e) => subscribed.includes(facultyOf(e.societyId)));
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

// The panel only ever shows the next two weeks, so we section by "This week" /
// "Next week" rather than by month — far easier to grasp than a date ("it's on
// Thursday" beats "it's on the 9th"). `key` is a translation key the panel maps
// to a localized heading; "later" is a safety bucket for anything further out.
export type WeekSectionKey = 'thisWeek' | 'nextWeek' | 'later';
export interface WeekSection {
  key: WeekSectionKey;
  events: MapEvent[];
}

// Monday 00:00 of the week containing `ref` (CZ/EU convention — week starts Mon).
function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return d;
}

export function weekSections(events: MapEvent[], now: Date = new Date()): WeekSection[] {
  const thisWeekStart = startOfWeek(now).getTime();
  const nextWeekStart = thisWeekStart + 7 * 86400_000;
  const weekAfterStart = thisWeekStart + 14 * 86400_000;
  const bucketOf = (e: MapEvent): WeekSectionKey => {
    const t = parseEventDate(e.date).getTime();
    if (t < nextWeekStart) return 'thisWeek';
    if (t < weekAfterStart) return 'nextWeek';
    return 'later';
  };

  const buckets = new Map<WeekSectionKey, MapEvent[]>();
  for (const e of sortByDate(events)) {
    const k = bucketOf(e);
    const arr = buckets.get(k);
    if (arr) arr.push(e); else buckets.set(k, [e]);
  }
  const order: WeekSectionKey[] = ['thisWeek', 'nextWeek', 'later'];
  return order.filter((k) => buckets.has(k)).map((k) => ({ key: k, events: buckets.get(k)! }));
}

// Relative, human day label for a row: "Today" / "Tomorrow" / weekday name
// ("Thursday"). Within a two-week window the weekday alone is unambiguous.
export function relativeDayLabel(
  iso: string, locale: string, t: (key: string) => string, now: Date = new Date(),
): string {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const days = Math.round((parseEventDate(iso).getTime() - start.getTime()) / 86400_000);
  if (days === 0) return t('map.today');
  if (days === 1) return t('map.tomorrow');
  return parseEventDate(iso).toLocaleDateString(locale, { weekday: 'long' });
}
