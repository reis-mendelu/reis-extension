import { describe, it, expect } from 'vitest';
import {
  daysUntilEvent,
  isPastEvent,
  SOON_WINDOW_DAYS,
  localTodayIso,
  isFinishedEvent,
  isSoonEvent,
  isBeyondSoon,
} from '../eventWindow';

const NOW = new Date('2026-07-06T09:00:00'); // local midnight anchor = 2026-07-06

describe('eventWindow', () => {
  it('daysUntilEvent counts whole days from local midnight', () => {
    expect(daysUntilEvent('2026-07-06', NOW)).toBe(0);
    expect(daysUntilEvent('2026-07-10', NOW)).toBe(4);
    expect(daysUntilEvent('2026-07-01', NOW)).toBe(-5);
  });
  it('isPastEvent classifies past events', () => {
    expect(isPastEvent('2026-07-05', NOW)).toBe(true);
    expect(isPastEvent('2026-07-06', NOW)).toBe(false);
  });
});

const ev = (date: string, endDate: string | null = null) => ({ date, endDate });

describe('eventWindow — soon horizon and finished', () => {
  it('SOON_WINDOW_DAYS is 14', () => expect(SOON_WINDOW_DAYS).toBe(14));
  it('localTodayIso is the local calendar day', () => {
    expect(localTodayIso(new Date('2026-07-06T23:59:00'))).toBe('2026-07-06');
  });
  it('a single-day event is finished the day after', () => {
    expect(isFinishedEvent(ev('2026-07-06'), NOW)).toBe(false);
    expect(isFinishedEvent(ev('2026-07-05'), NOW)).toBe(true);
  });
  it('a multi-day event is finished only after its end date', () => {
    expect(isFinishedEvent(ev('2026-07-01', '2026-07-06'), NOW)).toBe(false);
    expect(isFinishedEvent(ev('2026-07-01', '2026-07-05'), NOW)).toBe(true);
  });
  it('soon = not finished and starting before day 14', () => {
    expect(isSoonEvent(ev('2026-07-06'), NOW)).toBe(true);
    expect(isSoonEvent(ev('2026-07-19'), NOW)).toBe(true); // day 13
    expect(isSoonEvent(ev('2026-07-20'), NOW)).toBe(false); // day 14
    expect(isSoonEvent(ev('2026-07-01', '2026-07-08'), NOW)).toBe(true); // running trip
    expect(isSoonEvent(ev('2026-07-05'), NOW)).toBe(false);
  });
  it('isBeyondSoon is day 14 and later', () => {
    expect(isBeyondSoon('2026-07-19', NOW)).toBe(false);
    expect(isBeyondSoon('2026-07-20', NOW)).toBe(true);
  });
  it('keeps daysUntilEvent and isPastEvent', () => {
    expect(daysUntilEvent('2026-07-10', NOW)).toBe(4);
    expect(isPastEvent('2026-07-05', NOW)).toBe(true);
  });
});
