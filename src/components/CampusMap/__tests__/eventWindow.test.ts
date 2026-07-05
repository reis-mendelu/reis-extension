import { describe, it, expect } from 'vitest';
import {
  PUBLIC_WINDOW_DAYS,
  daysUntilEvent,
  isPastEvent,
  isPublicEvent,
  isScheduledEvent,
  goLiveDate,
} from '../eventWindow';

const NOW = new Date('2026-07-06T09:00:00'); // local midnight anchor = 2026-07-06

const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('eventWindow', () => {
  it('PUBLIC_WINDOW_DAYS is 14', () => {
    expect(PUBLIC_WINDOW_DAYS).toBe(14);
  });
  it('daysUntilEvent counts whole days from local midnight', () => {
    expect(daysUntilEvent('2026-07-06', NOW)).toBe(0);
    expect(daysUntilEvent('2026-07-10', NOW)).toBe(4);
    expect(daysUntilEvent('2026-07-01', NOW)).toBe(-5);
  });
  it('classifies past / public / scheduled by the 14-day window', () => {
    expect(isPastEvent('2026-07-05', NOW)).toBe(true);
    expect(isPublicEvent('2026-07-05', NOW)).toBe(false);

    expect(isPublicEvent('2026-07-06', NOW)).toBe(true); // today
    expect(isPublicEvent('2026-07-19', NOW)).toBe(true); // day 13, last public day
    expect(isScheduledEvent('2026-07-19', NOW)).toBe(false);

    expect(isPublicEvent('2026-07-20', NOW)).toBe(false); // day 14, no longer public
    expect(isScheduledEvent('2026-07-20', NOW)).toBe(true);
    expect(isScheduledEvent('2026-08-15', NOW)).toBe(true);
  });
  it('goLiveDate is the first day the event enters the public window', () => {
    // 2026-08-15 is day 40; it becomes public when daysUntil === 13 → 2026-08-02.
    expect(localISO(goLiveDate('2026-08-15', NOW))).toBe('2026-08-02');
  });
});
