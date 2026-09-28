import { describe, it, expect } from 'vitest';
import {
  sortByDate,
  groupEventsByVenue,
  weekSections,
  relativeDayLabel,
  eventWhenLabel,
} from '../eventHelpers';
import { MOCK_MAP_EVENTS } from './fixtures/mockMapEvents';
import type { MapEvent } from '../../../types/events';

describe('eventHelpers', () => {
  it('sortByDate orders soonest first by date then time', () => {
    const sorted = sortByDate(MOCK_MAP_EVENTS);
    for (let i = 1; i < sorted.length; i++) {
      const a = `${sorted[i - 1].date}${sorted[i - 1].time ?? ''}`;
      const b = `${sorted[i].date}${sorted[i].time ?? ''}`;
      expect(a <= b).toBe(true);
    }
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

  it('weekSections buckets into this week / next week / later (day 14+ → later)', () => {
    const ev = (id: string, date: string): MapEvent => ({ ...MOCK_MAP_EVENTS[0], id, date });
    const now = new Date('2026-01-05T12:00:00'); // a Monday
    const sections = weekSections(
      [ev('a', '2026-01-07'), ev('b', '2026-01-13'), ev('c', '2026-01-20')],
      now
    );
    expect(sections.map((s) => s.key)).toEqual(['thisWeek', 'nextWeek', 'later']);
    expect(sections[0].events.map((e) => e.id)).toEqual(['a']);
    expect(sections[1].events.map((e) => e.id)).toEqual(['b']);
    // 15 days out (day 14+) lands in "later", not "next week"
    expect(sections[2].events.map((e) => e.id)).toEqual(['c']);
  });

  it('buckets day 14 and later into "later"', () => {
    const ev = (id: string, date: string): MapEvent => ({ ...MOCK_MAP_EVENTS[0], id, date });
    const now = new Date('2026-07-06T09:00:00');
    const s = weekSections(
      [ev('a', '2026-07-07'), ev('b', '2026-07-15'), ev('c', '2026-07-20'), ev('d', '2026-11-23')],
      now
    );
    expect(s.map((x) => [x.key, x.events.map((e) => e.id)])).toEqual([
      ['thisWeek', ['a']],
      ['nextWeek', ['b']],
      ['later', ['c', 'd']],
    ]);
  });

  it('relativeDayLabel: Today / Tomorrow / this-week weekday / next-week date', () => {
    const t = (k: string) => k;
    const now = new Date('2026-01-05T12:00:00'); // Monday
    expect(relativeDayLabel('2026-01-05', 'en-US', t, now)).toBe('map.today');
    expect(relativeDayLabel('2026-01-06', 'en-US', t, now)).toBe('map.tomorrow');
    // rest of this week → bare (capitalised) weekday
    expect(relativeDayLabel('2026-01-08', 'en-US', t, now)).toBe('Thursday');
    // next week → explicit date + weekday, so it doesn't read as "this Tuesday"
    const next = relativeDayLabel('2026-01-13', 'en-US', t, now);
    expect(next).toContain('Tuesday');
    expect(next).toContain('13');
    expect(next).toBe('1/13 (Tuesday)');
  });

  it('labels later events with weekday and date', () => {
    const now = new Date('2026-07-06T09:00:00');
    expect(relativeDayLabel('2026-11-19', 'cs-CZ', (k) => k, now)).toBe('Čt 19. 11.');
    const en = relativeDayLabel('2026-11-19', 'en-US', (k) => k, now);
    // Node ICU may render the weekday/date separator as a narrow no-break space.
    if (en !== 'Thu, 11/19') expect(en).toMatch(/^Thu,?\s11\/19$/);
  });

  it('weekend: "tomorrow" stays in This week and is never filed under Next week', () => {
    const t = (k: string) => k;
    const sun = new Date('2026-01-11T12:00:00'); // a Sunday
    const tomorrow = '2026-01-12'; // Monday — would be a NEW calendar week
    // label says tomorrow…
    expect(relativeDayLabel(tomorrow, 'en-US', t, sun)).toBe('map.tomorrow');
    // …and the bucket agrees: This week, not Next week (the old calendar bug)
    const sections = weekSections([{ ...MOCK_MAP_EVENTS[0], id: 'a', date: tomorrow }], sun);
    expect(sections[0].key).toBe('thisWeek');
  });
  // A multi-day trip stays listed until its last day, so once it has started
  // its START is in the past. Labelled by the start it read as a weekday in
  // the future ("Monday" on the Wednesday of a Mon–Sun trip).
  describe('eventWhenLabel', () => {
    const t = (k: string, p?: Record<string, string | number>) =>
      p ? `${k}(${Object.values(p).join(',')})` : k;
    const trip = { date: '2026-11-23', endDate: '2026-11-29', time: null };

    it('labels a running multi-day event as ongoing until its end, not by its start', () => {
      const wed = new Date('2026-11-25T12:00:00');
      expect(eventWhenLabel(trip, 'cs-CZ', t, wed)).toBe('map.ongoingUntil(29. 11.)');
      expect(eventWhenLabel(trip, 'en-US', t, wed)).toBe('map.ongoingUntil(11/29)');
      // Still ongoing on its last day; the start time is no longer the news.
      const last = new Date('2026-11-29T09:00:00');
      expect(eventWhenLabel({ ...trip, time: '18:00' }, 'cs-CZ', t, last)).toBe(
        'map.ongoingUntil(29. 11.)'
      );
    });

    it('leaves a future multi-day event on its start label, time included', () => {
      const before = new Date('2026-11-20T12:00:00'); // Friday, trip starts Monday
      expect(eventWhenLabel({ ...trip, time: '07:30' }, 'en-US', t, before)).toBe('Monday · 07:30');
      // Its first day is "Today", not "ongoing".
      const first = new Date('2026-11-23T12:00:00');
      expect(eventWhenLabel(trip, 'en-US', t, first)).toBe('map.today');
    });

    it('labels a single-day event exactly as relativeDayLabel does', () => {
      const now = new Date('2026-01-05T12:00:00');
      expect(eventWhenLabel({ date: '2026-01-06', endDate: null, time: '19:00' }, 'en-US', t, now)).toBe(
        'map.tomorrow · 19:00'
      );
    });
  });
});
