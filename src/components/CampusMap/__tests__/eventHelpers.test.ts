import { describe, it, expect } from 'vitest';
import { sortByDate, filterEvents, groupEventsByVenue, monthSections } from '../eventHelpers';
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

  it('groupEventsByVenue clusters co-located events and excludes off-campus', () => {
    const groups = groupEventsByVenue(MOCK_MAP_EVENTS);
    const pinnable = MOCK_MAP_EVENTS.filter((e) => e.coord).length;
    const grouped = groups.reduce((n, g) => n + g.events.length, 0);
    expect(grouped).toBe(pinnable);
    // SU PEF events all sit on the Q coordinate → one venue group with >1 event.
    const multi = groups.find((g) => g.events.length > 1);
    expect(multi).toBeDefined();
  });

  it('groupEventsByVenue ignores events with null coord', () => {
    const off: MapEvent = { ...MOCK_MAP_EVENTS[0], id: 'x', coord: null };
    expect(groupEventsByVenue([off])).toHaveLength(0);
  });

  it('monthSections groups by month and keeps chronological order', () => {
    const sections = monthSections(MOCK_MAP_EVENTS, 'en-US');
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].label).toMatch(/September|October/);
  });
});
