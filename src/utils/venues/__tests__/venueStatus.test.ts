import { describe, it, expect } from 'vitest';
import { closureNotice, groupHours, venueStatus } from '../venueStatus';
import type { VenueHours } from '../../../types/campusMap';

const weekdays: VenueHours[] = ([1, 2, 3, 4, 5] as const).map((day) => ({
  day,
  open: '08:00',
  close: '18:00',
}));

// S-klub's hours are Prague time, whatever zone the phone is in.
describe('venueStatus', () => {
  it('is open on a weekday afternoon, until closing', () => {
    // Mon 9 Nov 2026, 13:30 in Prague (CET, UTC+1).
    expect(venueStatus(weekdays, new Date('2026-11-09T12:30:00Z'))).toMatchObject({
      open: true,
      closes: '18:00',
    });
  });

  it('opens later the same morning', () => {
    expect(venueStatus(weekdays, new Date('2026-11-09T06:30:00Z'))).toMatchObject({
      open: false,
      opens: '08:00',
      day: 1,
    });
  });

  it('closes at closing time sharp', () => {
    expect(venueStatus(weekdays, new Date('2026-11-09T17:00:00Z')).open).toBe(false);
  });

  it('after Friday closing, opens on Monday', () => {
    // Fri 13 Nov 2026, 19:00 in Prague.
    expect(venueStatus(weekdays, new Date('2026-11-13T18:00:00Z'))).toMatchObject({
      open: false,
      opens: '08:00',
      day: 1,
    });
  });

  it('reads the Prague day, not the UTC one, around midnight', () => {
    // 23:30 UTC on Sunday is already Monday 00:30 in Prague: opens that morning.
    expect(venueStatus(weekdays, new Date('2026-11-08T23:30:00Z'))).toMatchObject({
      open: false,
      opens: '08:00',
      day: 1,
    });
  });

  it('follows summer time', () => {
    // Mon 6 Jul 2026, 07:30 UTC is 09:30 in Prague (CEST, UTC+2): open.
    expect(venueStatus(weekdays, new Date('2026-07-06T07:30:00Z')).open).toBe(true);
  });

  it('says how many days until it opens', () => {
    // Sat 14 Nov 2026, noon: opens Monday 16 Nov, two days on.
    expect(venueStatus(weekdays, new Date('2026-11-14T11:00:00Z'))).toEqual({
      open: false,
      opens: '08:00',
      day: 1,
      date: '2026-11-16',
      inDays: 2,
    });
  });
});

// A dated closure (`venues.closed_from/closed_until`) wins over the hours.
describe('venueStatus with a closure', () => {
  const closure = { from: '2026-11-09', until: '2026-11-13' };

  it('is closed during it, and opens the day after it ends', () => {
    // Mon 9 Nov 2026, 13:30: inside the closure, opens Monday 16 Nov.
    expect(venueStatus(weekdays, new Date('2026-11-09T12:30:00Z'), closure)).toEqual({
      open: false,
      opens: '08:00',
      day: 1,
      date: '2026-11-16',
      inDays: 7,
    });
  });

  it('is open as usual before it starts', () => {
    // Fri 6 Nov 2026, 10:00.
    expect(venueStatus(weekdays, new Date('2026-11-06T09:00:00Z'), closure).open).toBe(true);
  });
});

describe('closureNotice', () => {
  const closure = { from: '2026-11-09', until: '2026-11-13' };

  it('announces a closure in progress', () => {
    expect(closureNotice(closure, new Date('2026-11-10T09:00:00Z'))?.state).toBe('now');
  });

  it('announces one starting within a week', () => {
    expect(closureNotice(closure, new Date('2026-11-03T09:00:00Z'))?.state).toBe('soon');
  });

  it('says nothing while it is far off, or once it is over', () => {
    expect(closureNotice(closure, new Date('2026-10-20T09:00:00Z'))).toBeNull();
    expect(closureNotice(closure, new Date('2026-11-14T09:00:00Z'))).toBeNull();
  });
});

describe('groupHours', () => {
  it('joins consecutive days with the same times', () => {
    expect(groupHours(weekdays)).toEqual([{ from: 1, to: 5, open: '08:00', close: '18:00' }]);
  });

  it('keeps a day with other times apart', () => {
    const hours: VenueHours[] = [
      ...weekdays.slice(0, 4),
      { day: 5, open: '08:00', close: '14:00' },
    ];
    expect(groupHours(hours)).toEqual([
      { from: 1, to: 4, open: '08:00', close: '18:00' },
      { from: 5, to: 5, open: '08:00', close: '14:00' },
    ]);
  });
});
