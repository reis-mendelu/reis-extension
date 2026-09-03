import { describe, it, expect } from 'vitest';
import { isOutsideTeaching } from '../teachingPeriod';
import type { TeachingWeekData } from '../../../api/teachingWeek';

/**
 * "On iPad it should also be clear when the schedule is outside of the semester
 * — when it starts on 21.9. the previous weeks/days should be clear that people
 * shouldn't expect to see schedule."
 *
 * Same source and same predicate as the desktop, which has had this since it
 * shipped.
 */
const data: TeachingWeekData = {
  weeks: [
    { week: 1, from: '2026-09-21', to: '2026-09-27' },
    { week: 2, from: '2026-09-28', to: '2026-10-04' },
  ],
  total: 2,
};

const on = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
};

describe('isOutsideTeaching', () => {
  it('is true before term starts', () => {
    expect(isOutsideTeaching(data, on('2026-09-03'))).toBe(true);
  });

  it('is true the day before the first teaching day', () => {
    expect(isOutsideTeaching(data, on('2026-09-20'))).toBe(true);
  });

  it('is false on the first teaching day', () => {
    expect(isOutsideTeaching(data, on('2026-09-21'))).toBe(false);
  });

  it('is false inside a later teaching week', () => {
    expect(isOutsideTeaching(data, on('2026-09-30'))).toBe(false);
  });

  it('is true after the last teaching week', () => {
    expect(isOutsideTeaching(data, on('2026-10-05'))).toBe(true);
  });

  it('claims nothing when the table has not arrived', () => {
    // A late fetch must not be reported as "outside the teaching period" — a
    // confident wrong answer is worse than the vague one it replaces.
    expect(isOutsideTeaching(null, on('2026-09-03'))).toBe(false);
    expect(isOutsideTeaching(undefined, on('2026-09-03'))).toBe(false);
  });

  it('respects a gap between teaching weeks', () => {
    // The reason this uses IS's table rather than "before the first lesson":
    // reading weeks and the exam period are holes in the middle, which an
    // earliest-lesson heuristic cannot see at all.
    const withGap: TeachingWeekData = {
      weeks: [
        { week: 1, from: '2026-09-21', to: '2026-09-27' },
        { week: 2, from: '2026-10-12', to: '2026-10-18' },
      ],
      total: 2,
    };
    expect(isOutsideTeaching(withGap, on('2026-10-05'))).toBe(true);
  });
});
