import { describe, it, expect } from 'vitest';
import { sortByDate, filterEvents, groupEventsByVenue, weekSections, relativeDayLabel } from '../eventHelpers';
import { MOCK_MAP_EVENTS } from '../../../api/mapEvents';
import { societyById } from '../../../data/societies';
import type { MapEvent, FacultyKey } from '../../../types/events';

const facultyOf = (id: string): FacultyKey => societyById(id).facultyKey;

describe('eventHelpers', () => {
  it('sortByDate orders soonest first by date then time', () => {
    const sorted = sortByDate(MOCK_MAP_EVENTS);
    for (let i = 1; i < sorted.length; i++) {
      const a = `${sorted[i - 1].date}${sorted[i - 1].time ?? ''}`;
      const b = `${sorted[i].date}${sorted[i].time ?? ''}`;
      expect(a <= b).toBe(true);
    }
  });

  it('filterEvents "all" keeps everything', () => {
    expect(filterEvents(MOCK_MAP_EVENTS, 'all', facultyOf, ['pef'])).toHaveLength(MOCK_MAP_EVENTS.length);
  });

  it('filterEvents "faculty" keeps only subscribed faculties (incl. ESN/mendelu)', () => {
    const out = filterEvents(MOCK_MAP_EVENTS, 'faculty', facultyOf, ['mendelu', 'pef']);
    const ids = new Set(out.map((e) => e.societyId));
    expect(ids.has('esn')).toBe(true); // mendelu
    expect(ids.has('supef')).toBe(true); // pef
    expect(ids.has('au_frrms')).toBe(false); // frrms not subscribed
  });

  it('groupEventsByVenue excludes off-campus and keeps every pinnable event', () => {
    const groups = groupEventsByVenue(MOCK_MAP_EVENTS);
    const pinnable = MOCK_MAP_EVENTS.filter((e) => e.coord).length;
    const grouped = groups.reduce((n, g) => n + g.events.length, 0);
    expect(grouped).toBe(pinnable);
  });

  it('groupEventsByVenue clusters two events sharing a coordinate into one group', () => {
    const base = MOCK_MAP_EVENTS.find((e) => e.coord)!;
    const a: MapEvent = { ...base, id: 'a' };
    const b: MapEvent = { ...base, id: 'b' };
    const groups = groupEventsByVenue([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
  });

  it('groupEventsByVenue ignores events with null coord', () => {
    const off: MapEvent = { ...MOCK_MAP_EVENTS[0], id: 'x', coord: null };
    expect(groupEventsByVenue([off])).toHaveLength(0);
  });

  it('weekSections buckets events into this week / next week / later', () => {
    const ev = (id: string, date: string): MapEvent => ({ ...MOCK_MAP_EVENTS[0], id, date });
    const now = new Date('2026-01-05T12:00:00'); // a Monday
    const sections = weekSections(
      [ev('a', '2026-01-07'), ev('b', '2026-01-13'), ev('c', '2026-01-20')],
      now,
    );
    expect(sections.map((s) => s.key)).toEqual(['thisWeek', 'nextWeek', 'later']);
    expect(sections[0].events[0].id).toBe('a');
  });

  it('relativeDayLabel returns Today / Tomorrow / weekday', () => {
    const t = (k: string) => k;
    const now = new Date('2026-01-05T12:00:00'); // Monday
    expect(relativeDayLabel('2026-01-05', 'en-US', t, now)).toBe('map.today');
    expect(relativeDayLabel('2026-01-06', 'en-US', t, now)).toBe('map.tomorrow');
    expect(relativeDayLabel('2026-01-08', 'en-US', t, now)).toBe('Thursday');
  });
});
