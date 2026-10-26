import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { weekSections, relativeDayLabel } from '../eventHelpers';
import { MOCK_MAP_EVENTS } from './fixtures/mockMapEvents';
import type { MapEvent } from '../../../types/events';

// The buckets count CALENDAR days. Adding fixed 24-hour steps to local
// midnight is an hour short across the spring clock change, so a day-7 event
// landed under "This week" while its own row said next week. CI runs in UTC,
// where there is no clock change, so the zone is pinned here — and checked,
// because a runtime that ignored TZ would make these tests pass vacuously.
const savedTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Prague';
});
afterAll(() => {
  process.env.TZ = savedTz;
});

const ev = (id: string, date: string): MapEvent => ({ ...MOCK_MAP_EVENTS[0]!, id, date });
const t = (k: string) => k;

describe('weekSections across a clock change (Europe/Prague)', () => {
  it('really runs in a zone with a clock change', () => {
    expect(new Date(2026, 2, 28).getTimezoneOffset()).not.toBe(
      new Date(2026, 2, 30).getTimezoneOffset()
    );
  });

  // Clocks go forward on Sun 29 Mar 2026: that day has 23 hours.
  it('puts day 7 and day 14 in the right bucket over the spring change', () => {
    const now = new Date(2026, 2, 23, 12); // Mon 23 Mar, 12:00
    const s = weekSections(
      [ev('d6', '2026-03-29'), ev('d7', '2026-03-30'), ev('d14', '2026-04-06')],
      now
    );
    expect(s.map((x) => [x.key, x.events.map((e) => e.id)])).toEqual([
      ['thisWeek', ['d6']],
      ['nextWeek', ['d7']],
      ['later', ['d14']],
    ]);
    expect(relativeDayLabel('2026-03-30', 'en-US', t, now)).not.toBe('Monday');
  });

  // Clocks go back on Sun 25 Oct 2026: that day has 25 hours.
  it('puts day 7 and day 14 in the right bucket over the autumn change', () => {
    const now = new Date(2026, 9, 19, 12); // Mon 19 Oct, 12:00
    const s = weekSections(
      [ev('d6', '2026-10-25'), ev('d7', '2026-10-26'), ev('d14', '2026-11-02')],
      now
    );
    expect(s.map((x) => [x.key, x.events.map((e) => e.id)])).toEqual([
      ['thisWeek', ['d6']],
      ['nextWeek', ['d7']],
      ['later', ['d14']],
    ]);
  });
});
