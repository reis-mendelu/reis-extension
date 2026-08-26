/**
 * These four helpers decide which week the timetable asks IS for. Every bug they
 * can have is an off-by-one at a week boundary, and the symptom is always the
 * same: a student opens reIS and sees the wrong week, most often on the Sunday
 * or Monday when the boundary flips.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, getScheduleFormat, getWeekRange, getLastWeekData, parseDate } from '../date';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const iso = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

afterEach(() => vi.useRealTimers());

describe('formatDate', () => {
  it('renders DD.MM.YYYY with zero padding', () => {
    expect(formatDate(d(2026, 3, 7))).toBe('07.03.2026');
  });

  it('does not pad the year', () => {
    expect(formatDate(d(2026, 12, 25))).toBe('25.12.2026');
  });

  it('is what getScheduleFormat delegates to', () => {
    const day = d(2026, 1, 1);
    expect(getScheduleFormat(day)).toBe(formatDate(day));
  });
});

describe('getWeekRange', () => {
  it('runs Monday to Sunday for a midweek date', () => {
    const { start, end } = getWeekRange(d(2026, 3, 11)); // Wednesday
    expect(iso(start)).toBe('2026-03-09'); // Mon
    expect(iso(end)).toBe('2026-03-15'); // Sun
  });

  it('treats Sunday as the END of the week just gone, not the start of the next', () => {
    // The -6 branch. Without it, Sunday jumps a week forward and the student
    // loses the day they are actually looking at.
    const { start, end } = getWeekRange(d(2026, 3, 15)); // Sunday
    expect(iso(start)).toBe('2026-03-09');
    expect(iso(end)).toBe('2026-03-15');
  });

  it('keeps Monday as its own week start', () => {
    const { start } = getWeekRange(d(2026, 3, 9));
    expect(iso(start)).toBe('2026-03-09');
  });

  it('spans a month boundary', () => {
    const { start, end } = getWeekRange(d(2026, 4, 1)); // Wed 1 Apr
    expect(iso(start)).toBe('2026-03-30');
    expect(iso(end)).toBe('2026-04-05');
  });

  it('covers the whole first and last day', () => {
    const { start, end } = getWeekRange(d(2026, 3, 11));
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
    expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([23, 59, 59]);
  });

  it('does not mutate the date it was given', () => {
    const input = d(2026, 3, 11);
    getWeekRange(input);
    expect(iso(input)).toBe('2026-03-11');
  });
});

describe('getLastWeekData', () => {
  it('returns the current Mon-Fri on a weekday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 3, 11)); // Wednesday
    expect(getLastWeekData()).toEqual(['09.03.2026', '13.03.2026']);
  });

  it('skips FORWARD to next week on a Saturday', () => {
    // Nobody wants Saturday to show the week that just ended -- by then the
    // useful answer is the week about to start.
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 3, 14)); // Saturday
    expect(getLastWeekData()).toEqual(['16.03.2026', '20.03.2026']);
  });

  it('skips forward on a Sunday too', () => {
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 3, 15)); // Sunday
    expect(getLastWeekData()).toEqual(['16.03.2026', '20.03.2026']);
  });

  it('returns Monday as itself', () => {
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 3, 9));
    expect(getLastWeekData()).toEqual(['09.03.2026', '13.03.2026']);
  });
});

describe('parseDate', () => {
  it('parses an explicit year', () => {
    expect(iso(parseDate('15.01.2025', '10:00'))).toBe('2025-01-15');
  });

  it('falls back to the current year when the date omits it', () => {
    // IS renders "15.01." inside a semester view where the year is implied.
    vi.useFakeTimers();
    vi.setSystemTime(d(2026, 6, 1));
    expect(iso(parseDate('15.01.', '10:00'))).toBe('2026-01-15');
  });

  it('applies the time of day', () => {
    const parsed = parseDate('15.01.2025', '14:35');
    expect([parsed.getHours(), parsed.getMinutes()]).toEqual([14, 35]);
  });

  it('handles a single-digit day and month', () => {
    expect(iso(parseDate('5.3.2026', '08:00'))).toBe('2026-03-05');
  });

  it('converts the month to zero-indexed, so January is not February', () => {
    expect(parseDate('01.01.2026', '00:00').getMonth()).toBe(0);
  });
});
