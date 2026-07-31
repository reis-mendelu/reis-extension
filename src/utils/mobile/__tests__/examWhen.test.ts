import { describe, it, expect } from 'vitest';
import {
  startOfWeek,
  isSameWeek,
  isSameDay,
  trimHour,
  formatDayMonth,
  formatWhenShort,
  formatWhenRow,
  splitByWeek,
} from '../examWhen';

// Monday 20 July 2026 — the day the design's screens are drawn on.
const monday = new Date(2026, 6, 20, 9, 0);

describe('startOfWeek', () => {
  it('rolls back to Monday', () => {
    expect(startOfWeek(new Date(2026, 6, 23, 13, 0)).getDate()).toBe(20);
  });

  // The off-by-one that a naive `getDay()` subtraction produces: JS weeks
  // start on Sunday, Czech ones do not.
  it('treats Sunday as the END of its week, not the start', () => {
    expect(startOfWeek(new Date(2026, 6, 26, 23, 0)).getDate()).toBe(20);
  });

  it('is already Monday for a Monday', () => {
    const d = startOfWeek(monday);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
  });
});

describe('isSameWeek', () => {
  it.each([
    ['Monday itself', new Date(2026, 6, 20, 0, 1), true],
    ['Friday of the same week', new Date(2026, 6, 24, 11, 0), true],
    ['Sunday of the same week', new Date(2026, 6, 26, 23, 59), true],
    ['the following Monday', new Date(2026, 6, 27, 9, 0), false],
    ['the previous Sunday', new Date(2026, 6, 19, 9, 0), false],
  ])('%s', (_label, date, expected) => {
    expect(isSameWeek(date, monday)).toBe(expected);
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(new Date(2026, 6, 20, 23, 59), monday)).toBe(true);
    expect(isSameDay(new Date(2026, 6, 21, 0, 1), monday)).toBe(false);
  });
});

describe('trimHour', () => {
  it('drops the padding zero IS sends', () => {
    expect(trimHour('08:00')).toBe('8:00');
    expect(trimHour('15:00')).toBe('15:00');
    expect(trimHour('09:30')).toBe('9:30');
  });
});

describe('formatDayMonth', () => {
  it('renders the Czech short weekday with trailing dots', () => {
    expect(formatDayMonth(new Date(2026, 6, 21), 'cs-CZ')).toBe('út 21. 7.');
    expect(formatDayMonth(new Date(2026, 6, 27), 'cs-CZ')).toBe('po 27. 7.');
  });

  it('renders the English short weekday', () => {
    expect(formatDayMonth(new Date(2026, 6, 21), 'en-US')).toBe('Tue 21. 7.');
  });
});

describe('formatWhenShort', () => {
  it('says "dnes" instead of repeating today\'s date', () => {
    expect(formatWhenShort(new Date(2026, 6, 20), '15:00', monday, 'cs-CZ', 'dnes')).toBe(
      'dnes · 15:00'
    );
  });

  it('spells out any other day', () => {
    expect(formatWhenShort(new Date(2026, 6, 21), '08:00', monday, 'cs-CZ', 'dnes')).toBe(
      'út 21. 7. · 8:00'
    );
  });
});

describe('formatWhenRow', () => {
  it('separates date and time with a space, not a dot', () => {
    expect(formatWhenRow(new Date(2026, 6, 27), '09:00', 'cs-CZ')).toBe('po 27. 7. 9:00');
  });
});

describe('splitByWeek', () => {
  it('splits on the week boundary, not on a rolling seven days', () => {
    const dates = [
      new Date(2026, 6, 22),
      new Date(2026, 6, 24),
      new Date(2026, 6, 26),
      new Date(2026, 6, 27),
      new Date(2026, 6, 31),
    ];
    const { thisWeek, later } = splitByWeek(dates, (d) => d, monday);
    expect(thisWeek.map((d) => d.getDate())).toEqual([22, 24, 26]);
    expect(later.map((d) => d.getDate())).toEqual([27, 31]);
  });

  it('keeps an already-passed exam in this week', () => {
    const { thisWeek } = splitByWeek(
      [new Date(2026, 6, 20, 8, 0)],
      (d) => d,
      new Date(2026, 6, 22, 9, 0)
    );
    expect(thisWeek).toHaveLength(1);
  });
});
