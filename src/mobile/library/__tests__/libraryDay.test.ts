import { describe, expect, it } from 'vitest';
import {
  hourStates,
  lessonHours,
  nextFree,
  rangeOf,
  roomStatus,
  shownDay,
  toggleHour,
  weekdaysFrom,
} from '../libraryDay';
import type { Block } from '../availability';

// Monday 16 November 2026.
const MON = '2026-11-16';
const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
const free = (day: string, from: number, to: number): Block => ({
  status: 'free',
  start: `${day}T${String(from).padStart(2, '0')}:00`,
  end: `${day}T${String(to).padStart(2, '0')}:00`,
});

describe('shownDay', () => {
  it('is today while an hour of today can still be booked', () => {
    expect(shownDay(at(9))).toEqual({ day: MON, today: true });
    expect(shownDay(at(17, 0))).toEqual({ day: MON, today: true });
  });

  it('moves to the next weekday once today has nothing left to book, and says so', () => {
    expect(shownDay(at(17, 1))).toEqual({ day: '2026-11-17', today: false });
    expect(shownDay(at(19, 30))).toEqual({ day: '2026-11-17', today: false });
  });

  it('skips the weekend', () => {
    expect(shownDay(new Date(2026, 10, 20, 18))).toEqual({ day: '2026-11-23', today: false });
    expect(shownDay(new Date(2026, 10, 21, 10))).toEqual({ day: '2026-11-23', today: false });
  });
});

describe('weekdaysFrom', () => {
  it('lists five weekdays from the shown day', () => {
    expect(weekdaysFrom('2026-11-19')).toEqual([
      '2026-11-19',
      '2026-11-20',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
    ]);
  });
});

describe('hourStates', () => {
  it('tells a past hour from one someone took, and marks the student’s classes', () => {
    const blocks = [free(MON, 13, 19)];
    const s = hourStates(blocks, MON, at(11, 30), new Set([14]));
    expect(s.find((h) => h.hour === 9)).toEqual({ hour: 9, state: 'past', lesson: false });
    // 12:00 starts within the hour's notice: no longer bookable, and it is not "taken".
    expect(s.find((h) => h.hour === 12)?.state).toBe('past');
    expect(s.find((h) => h.hour === 13)).toEqual({ hour: 13, state: 'free', lesson: false });
    expect(s.find((h) => h.hour === 14)).toEqual({ hour: 14, state: 'free', lesson: true });
  });

  it('calls an hour of a later day that is not free taken, never past', () => {
    const s = hourStates([free('2026-11-17', 9, 10)], '2026-11-17', at(19), new Set());
    expect(s.find((h) => h.hour === 7)?.state).toBe('taken');
    expect(s.find((h) => h.hour === 9)?.state).toBe('free');
  });
});

describe('toggleHour', () => {
  const freeHours = [9, 10, 11, 12, 15];
  it('starts a selection, grows it by a neighbour and shrinks it from an end', () => {
    let sel = toggleHour([], 10, freeHours, 4);
    expect(sel).toEqual([10]);
    sel = toggleHour(sel, 11, freeHours, 4);
    expect(sel).toEqual([10, 11]);
    sel = toggleHour(sel, 9, freeHours, 4);
    expect(sel).toEqual([9, 10, 11]);
    sel = toggleHour(sel, 9, freeHours, 4);
    expect(sel).toEqual([10, 11]);
  });

  it('starts over on an hour that does not touch the selection', () => {
    expect(toggleHour([10, 11], 15, freeHours, 4)).toEqual([15]);
  });

  it('never grows past what is left of the daily cap', () => {
    expect(toggleHour([9, 10], 11, freeHours, 2)).toEqual([9, 10]);
  });

  it('ignores an hour that is not free', () => {
    expect(toggleHour([10], 13, freeHours, 4)).toEqual([10]);
  });

  it('keeps the middle of a range: dropping it would split one booking in two', () => {
    expect(toggleHour([9, 10, 11], 10, freeHours, 4)).toEqual([9, 10, 11]);
  });
});

describe('rangeOf', () => {
  it('reads a selection as one span', () => {
    expect(rangeOf([14, 15])).toEqual({ from: 14, to: 16 });
    expect(rangeOf([])).toBeNull();
  });
});

describe('roomStatus', () => {
  it('says nothing about free or full until it knows', () => {
    expect(roomStatus(undefined, MON, at(9), true)).toEqual({ kind: 'loading' });
    expect(roomStatus(null, MON, at(9), false)).toEqual({ kind: 'unknown' });
  });

  it('names the first bookable hour, or full', () => {
    expect(roomStatus([free(MON, 13, 15)], MON, at(9), false)).toEqual({ kind: 'from', hour: 13 });
    expect(roomStatus([], MON, at(9), false)).toEqual({ kind: 'full' });
  });
});

describe('nextFree', () => {
  it('finds the first free hour after a full day', () => {
    const blocks = [free('2026-11-18', 9, 11)];
    expect(nextFree(blocks, ['2026-11-17', '2026-11-18'], at(9))).toEqual({
      day: '2026-11-18',
      hour: 9,
    });
    expect(nextFree([], ['2026-11-17'], at(9))).toBeNull();
  });
});

describe('lessonHours', () => {
  it('marks every library hour a class touches, and only real classes of that day', () => {
    const lessons = [
      { date: '20261116', startTime: '17:00', endTime: '18:50' },
      { date: '20261116', startTime: '09:00', endTime: '10:00', isCustom: true },
      { date: '20261117', startTime: '07:00', endTime: '08:50' },
    ];
    expect([...lessonHours(lessons, MON)]).toEqual([17, 18]);
  });
});
