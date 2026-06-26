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

// Section a sorted list into month headings ("October 2026") for the panel.
export interface MonthSection {
  label: string;
  events: MapEvent[];
}

export function monthSections(events: MapEvent[], locale: string): MonthSection[] {
  const sorted = sortByDate(events);
  const sections: MonthSection[] = [];
  let current: MonthSection | null = null;
  for (const e of sorted) {
    const label = parseEventDate(e.date).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    if (!current || current.label !== label) {
      current = { label, events: [e] };
      sections.push(current);
    } else {
      current.events.push(e);
    }
  }
  return sections;
}
