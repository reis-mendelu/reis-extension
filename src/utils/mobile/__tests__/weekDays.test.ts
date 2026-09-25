import { describe, it, expect } from 'vitest';
import { weekDays, toIso, mondayOf, stepDay } from '../weekDays';

// Mon 21 Sep 2026 … Sun 27 Sep 2026.
const MONDAY = '2026-09-21';
const SATURDAY = '2026-09-26';
const SUNDAY = '2026-09-27';

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
    const days = weekDays(MONDAY, lessons).map(toIso);
    expect(days).toHaveLength(5);
    expect(days).not.toContain(SATURDAY);
    expect(days).not.toContain(SUNDAY);
  });

  it('carries Saturday in EVERY week for a student with any Saturday lesson', () => {
    // The Saturday lesson is in October; this week's Saturday is empty.
    const lessons = new Set(['20260921', '20261010']);
    const days = weekDays(MONDAY, lessons).map(toIso);
    expect(days).toContain(SATURDAY);
    expect(days).not.toContain(SUNDAY);
  });

  it('adds Sunday on its own evidence, independently of Saturday', () => {
    const lessons = new Set(['20261011']); // a Sunday
    const days = weekDays(MONDAY, lessons).map(toIso);
    expect(days).toContain(SUNDAY);
    expect(days).not.toContain(SATURDAY);
  });

  it('gives the same week whichever of its days is selected', () => {
    // Including a Sunday, which `mondayOf` has to walk BACK six days from
    // rather than forward one — the bug that would land a student on next week.
    const lessons = new Set(['20261010', '20261011']);
    const fromMonday = weekDays(MONDAY, lessons).map(toIso);
    expect(weekDays(SUNDAY, lessons).map(toIso)).toEqual(fromMonday);
    expect(weekDays(SATURDAY, lessons).map(toIso)).toEqual(fromMonday);
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
    expect(stepDay(FRIDAY, 1, weekdaysOnly)).toBe(NEXT_MONDAY);
  });

  it('goes from Monday back to Friday for that student', () => {
    expect(stepDay(NEXT_MONDAY, -1, weekdaysOnly)).toBe(FRIDAY);
  });

  it('stops on Saturday for a student with a Saturday lesson anywhere in the semester', () => {
    const withSaturday = new Set(['20260921', '20261010']);
    expect(stepDay(FRIDAY, 1, withSaturday)).toBe(SATURDAY);
    expect(stepDay(SATURDAY, 1, withSaturday)).toBe(NEXT_MONDAY);
  });

  it('leaves a hidden weekend day for the nearest shown one in either direction', () => {
    // The calendar can open on a Saturday (it is simply today), and the strip
    // has no chip for it — a swipe from there still has to go somewhere real.
    expect(stepDay(SATURDAY, 1, weekdaysOnly)).toBe(NEXT_MONDAY);
    expect(stepDay(SATURDAY, -1, weekdaysOnly)).toBe(FRIDAY);
    expect(stepDay(SUNDAY, -1, weekdaysOnly)).toBe(FRIDAY);
  });

  it('is an ordinary day step inside the week', () => {
    expect(stepDay(MONDAY, 1, weekdaysOnly)).toBe('2026-09-22');
  });
});
