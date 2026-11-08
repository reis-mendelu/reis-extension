import { describe, it, expect } from 'vitest';
import { venueStatus } from '../venueStatus';
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
    expect(venueStatus(weekdays, new Date('2026-11-09T12:30:00Z'))).toEqual({
      open: true,
      closes: '18:00',
    });
  });

  it('opens later the same morning', () => {
    expect(venueStatus(weekdays, new Date('2026-11-09T06:30:00Z'))).toEqual({
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
    expect(venueStatus(weekdays, new Date('2026-11-13T18:00:00Z'))).toEqual({
      open: false,
      opens: '08:00',
      day: 1,
    });
  });

  it('reads the Prague day, not the UTC one, around midnight', () => {
    // 23:30 UTC on Sunday is already Monday 00:30 in Prague: opens that morning.
    expect(venueStatus(weekdays, new Date('2026-11-08T23:30:00Z'))).toEqual({
      open: false,
      opens: '08:00',
      day: 1,
    });
  });

  it('follows summer time', () => {
    // Mon 6 Jul 2026, 07:30 UTC is 09:30 in Prague (CEST, UTC+2): open.
    expect(venueStatus(weekdays, new Date('2026-07-06T07:30:00Z')).open).toBe(true);
  });
});
