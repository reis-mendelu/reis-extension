import { describe, it, expect } from 'vitest';
import { weekDays, toIso, mondayOf, stepDay } from '../weekDays';

// Mon 21 Sep 2026 … Sun 27 Sep 2026.
const MONDAY = '2026-09-21';
const SATURDAY = '2026-09-26';
const SUNDAY = '2026-09-27';
// A today outside every week below, for the tests about the student's own rule.
const ELSEWHERE = '2026-01-07';

describe('weekDays', () => {
  it('starts the week on Monday, whichever day is selected', () => {
    expect(toIso(mondayOf(SUNDAY))).toBe(MONDAY);
    expect(toIso(mondayOf(MONDAY))).toBe(MONDAY);
  });

  /**
   * The weekend is a property of the STUDENT, not of the week: "ukazuj to
   * pouze pro lidi, co mají výuku v ty dny o víkendu — pokud student v těch
   * dnech nikdy mít výuku nebude, neukazuj mu to".
   *
   * Two rules were tried before this one. Mon–Fri plus a weekend day only when
   * THAT week had a lesson on it left a combined-study student's lesson-free
   * Saturday unreachable in the weeks between their teaching blocks. Always
   * seven days then showed two empty chips to every full-time student, all
   * semester. `lessonDates` is the whole stored semester, so "has this student
   * ever got a Saturday lesson" is answerable, and answers both.
   */
  it('is Mon–Fri for a student who is never taught at the weekend', () => {
    const lessons = new Set(['20260921', '20260922', '20261002']);
    const days = weekDays(MONDAY, lessons, ELSEWHERE).map(toIso);
    expect(days).toHaveLength(5);
    expect(days).not.toContain(SATURDAY);
    expect(days).not.toContain(SUNDAY);
  });

  it('carries Saturday in EVERY week for a student with any Saturday lesson', () => {
    // The Saturday lesson is in October; this week's Saturday is empty.
    const lessons = new Set(['20260921', '20261010']);
    const days = weekDays(MONDAY, lessons, ELSEWHERE).map(toIso);
    expect(days).toContain(SATURDAY);
    expect(days).not.toContain(SUNDAY);
  });

  it('adds Sunday on its own evidence, independently of Saturday', () => {
    const lessons = new Set(['20261011']); // a Sunday
    const days = weekDays(MONDAY, lessons, ELSEWHERE).map(toIso);
    expect(days).toContain(SUNDAY);
    expect(days).not.toContain(SATURDAY);
  });

  it('gives the same week whichever of its days is selected', () => {
    // Including a Sunday, which `mondayOf` has to walk BACK six days from
    // rather than forward one — the bug that would land a student on next week.
    const lessons = new Set(['20261010', '20261011']);
    const fromMonday = weekDays(MONDAY, lessons, ELSEWHERE).map(toIso);
    expect(weekDays(SUNDAY, lessons, ELSEWHERE).map(toIso)).toEqual(fromMonday);
    expect(weekDays(SATURDAY, lessons, ELSEWHERE).map(toIso)).toEqual(fromMonday);
  });

  /**
   * On Saturday 3 October 2026 the calendar opened on today and the strip had
   * no chip for it: a full-time student's week is Mon–Fri, so the selected day
   * was simply not on screen. Google and Apple always show today; reIS now
   * adds today's weekend day to today's week, and only to that week.
   */
  it('adds a lesson-free weekend day when it is today', () => {
    const lessons = new Set(['20260921']);
    expect(weekDays(MONDAY, lessons, SATURDAY).map(toIso)).toEqual([
      MONDAY,
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      SATURDAY,
    ]);
    expect(weekDays(SUNDAY, lessons, SUNDAY).map(toIso)).toContain(SUNDAY);
    expect(weekDays(SUNDAY, lessons, SUNDAY).map(toIso)).not.toContain(SATURDAY);
  });

  it('leaves the other weeks at Mon–Fri', () => {
    const lessons = new Set(['20260921']);
    // Today is Saturday 26 September; the week after it is unaffected.
    expect(weekDays('2026-09-28', lessons, SATURDAY)).toHaveLength(5);
  });
});

/**
 * Swiping the agenda a day at a time has to land on the days the strip
 * offers. It used to add one calendar day, so a full-time student swiping
 * past Friday landed on an empty Saturday and then an empty Sunday — two days
 * the strip above does not even have a chip for.
 */
describe('stepDay', () => {
  const FRIDAY = '2026-09-25';
  const NEXT_MONDAY = '2026-09-28';
  const weekdaysOnly = new Set(['20260921', '20260925']);

  it('goes from Friday to Monday for a student never taught at the weekend', () => {
    expect(stepDay(FRIDAY, 1, weekdaysOnly, ELSEWHERE)).toBe(NEXT_MONDAY);
  });

  it('goes from Monday back to Friday for that student', () => {
    expect(stepDay(NEXT_MONDAY, -1, weekdaysOnly, ELSEWHERE)).toBe(FRIDAY);
  });

  it('stops on Saturday for a student with a Saturday lesson anywhere in the semester', () => {
    const withSaturday = new Set(['20260921', '20261010']);
    expect(stepDay(FRIDAY, 1, withSaturday, ELSEWHERE)).toBe(SATURDAY);
    expect(stepDay(SATURDAY, 1, withSaturday, ELSEWHERE)).toBe(NEXT_MONDAY);
  });

  it('leaves a hidden weekend day for the nearest shown one in either direction', () => {
    // The calendar can open on a Saturday (it is simply today), and the strip
    // has no chip for it — a swipe from there still has to go somewhere real.
    expect(stepDay(SATURDAY, 1, weekdaysOnly, ELSEWHERE)).toBe(NEXT_MONDAY);
    expect(stepDay(SATURDAY, -1, weekdaysOnly, ELSEWHERE)).toBe(FRIDAY);
    expect(stepDay(SUNDAY, -1, weekdaysOnly, ELSEWHERE)).toBe(FRIDAY);
  });

  it('stops on today when today is a lesson-free weekend day', () => {
    expect(stepDay(FRIDAY, 1, weekdaysOnly, SATURDAY)).toBe(SATURDAY);
    expect(stepDay(NEXT_MONDAY, -1, weekdaysOnly, SUNDAY)).toBe(SUNDAY);
  });

  it('is an ordinary day step inside the week', () => {
    expect(stepDay(MONDAY, 1, weekdaysOnly, ELSEWHERE)).toBe('2026-09-22');
  });
});
