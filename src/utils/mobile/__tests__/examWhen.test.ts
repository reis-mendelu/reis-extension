import { describe, it, expect } from 'vitest';
import { dropFinished, trimHour, formatDayMonth, formatWhenRow } from '../examWhen';

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

describe('formatWhenRow', () => {
  it('separates date and time with a space, not a dot', () => {
    expect(formatWhenRow(new Date(2026, 6, 27), '09:00', 'cs-CZ')).toBe('po 27. 7. 9:00');
  });
});

/**
 * A registered exam IS still lists after it has been sat — it stays until it
 * is graded. The phone showed it as the next thing coming ("Co tě čeká" first,
 * with the upcoming dot), filed it under "Přihlášené · později" because it was
 * not in this week, and offered "Odhlásit" for it. The decision: hide it.
 *
 * Hidden once its DAY is over, not once its start time passes: on the day a
 * student still wants the room and the time in front of them, including when
 * they are running late for it.
 */
describe('dropFinished', () => {
  const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);
  const NOW = at(2026, 9, 21, 18); // Monday evening

  it('drops an exam whose day is over', () => {
    const rows = [{ id: 'fri', date: at(2026, 9, 18, 13) }];
    expect(dropFinished(rows, (r) => r.date, NOW)).toEqual([]);
  });

  it("keeps today's exam even after it started", () => {
    const rows = [{ id: 'today', date: at(2026, 9, 21, 9) }];
    expect(dropFinished(rows, (r) => r.date, NOW).map((r) => r.id)).toEqual(['today']);
  });

  it('keeps everything still to come', () => {
    const rows = [
      { id: 'past', date: at(2026, 9, 1, 9) },
      { id: 'wed', date: at(2026, 9, 23, 9) },
      { id: 'oct', date: at(2026, 10, 7, 10) },
    ];
    expect(dropFinished(rows, (r) => r.date, NOW).map((r) => r.id)).toEqual(['wed', 'oct']);
  });
});
