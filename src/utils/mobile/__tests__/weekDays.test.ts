import { describe, it, expect } from 'vitest';
import { weekDays, toIso, mondayOf, stepDay, stepWeek } from '../weekDays';

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

/**
 * A week arrow from today's Saturday used to land on the next Saturday — a day
 * the strip has no chip for, so the header named a day nobody could see. The
 * same defect the today chip fixed, one tap away from it.
 */
describe('stepWeek', () => {
  const weekdaysOnly = new Set(['20260921']);

  it('moves seven days when the target day is shown', () => {
    expect(stepWeek('2026-09-23', 1, weekdaysOnly, ELSEWHERE)).toBe('2026-09-30');
    expect(stepWeek('2026-09-23', -1, weekdaysOnly, ELSEWHERE)).toBe('2026-09-16');
  });

  it('settles on the last shown day when the target is a hidden weekend day', () => {
    // From today, Saturday 26 September: next week's Saturday is hidden → Friday 2 Oct.
    expect(stepWeek(SATURDAY, 1, weekdaysOnly, SATURDAY)).toBe('2026-10-02');
    expect(stepWeek(SATURDAY, -1, weekdaysOnly, SATURDAY)).toBe('2026-09-18');
    expect(stepWeek(SUNDAY, 1, weekdaysOnly, SUNDAY)).toBe('2026-10-02');
  });

  it('comes back onto today when the week arrow returns to it', () => {
    expect(stepWeek('2026-10-03', -1, weekdaysOnly, SATURDAY)).toBe(SATURDAY);
  });

  /**
   * "When I switch to a next week, the 9th of October gets highlighted … and
   * on Saturday returning to today highlights Friday instead" — Saturday
   * 3 October 2026. Forward clamps today's Saturday to Friday 9, which is
   * reachable; the case above starts from a hidden Saturday no arrow ever
   * lands on, so it passed while the real round trip went Sat 3 → Fri 9 →
   * Fri 2. Stepping into today's week lands on today, whatever day it left.
   */
  describe('into the week that holds today', () => {
    const SAT_3_OCT = '2026-10-03';
    const SUN_4_OCT = '2026-10-04';
    const there = (from: string, today: string) =>
      stepWeek(stepWeek(from, 1, weekdaysOnly, today), -1, weekdaysOnly, today);

    it('brings a round trip from a lesson-free Saturday today back to it', () => {
      expect(stepWeek(SAT_3_OCT, 1, weekdaysOnly, SAT_3_OCT)).toBe('2026-10-09');
      expect(there(SAT_3_OCT, SAT_3_OCT)).toBe(SAT_3_OCT);
    });

    it('does the same from a Sunday today, and from the week before', () => {
      expect(there(SUN_4_OCT, SUN_4_OCT)).toBe(SUN_4_OCT);
      expect(stepWeek('2026-09-25', 1, weekdaysOnly, SAT_3_OCT)).toBe(SAT_3_OCT);
    });

    it('lands on a weekday today from any day of a neighbouring week', () => {
      // Wednesday 7 October is today; the arrow from Monday 12 or Friday 2.
      expect(stepWeek('2026-10-12', -1, weekdaysOnly, '2026-10-07')).toBe('2026-10-07');
      expect(stepWeek('2026-10-02', 1, weekdaysOnly, '2026-10-07')).toBe('2026-10-07');
    });

    it('keeps Saturday to Saturday for a student taught at the weekend', () => {
      const withSaturday = new Set(['20260921', '20261010']);
      expect(stepWeek(SAT_3_OCT, 1, withSaturday, SAT_3_OCT)).toBe('2026-10-10');
      expect(stepWeek('2026-10-10', -1, withSaturday, SAT_3_OCT)).toBe(SAT_3_OCT);
    });
  });
});
