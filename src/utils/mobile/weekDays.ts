/**
 * Which days the phone's day strip shows, and the date arithmetic around it.
 *
 * Lifted out of `DayChips` because the strip is no longer the only thing that
 * needs the answer: the screen header now labels the week the strip is showing,
 * and two independent computations of "which week is this" is precisely how the
 * strip and the header came to disagree the first time — the row was anchored
 * to `schedule.weekStart`, which the sync (`fetchFullSemesterSchedule`) writes as the semester start,
 * so a device in April offered five days in February.
 */

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

/** IS's compact form, which is how `lessonDates` is keyed. */
export function toCompact(iso: string): string {
  return iso.replace(/-/g, '');
}

export function mondayOf(iso: string): Date {
  const date = fromIso(iso);
  const day = date.getDay();
  // Sunday is 0, so `1 - day` would jump FORWARD into the next week —
  // walk back six days instead.
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

export function shiftIso(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Whether any stored lesson falls on the given weekday (0 = Sunday … 6). */
function taughtOn(lessonDates: ReadonlySet<string>, weekday: number): boolean {
  for (const compact of lessonDates) {
    const d = new Date(+compact.slice(0, 4), +compact.slice(4, 6) - 1, +compact.slice(6, 8));
    if (d.getDay() === weekday) return true;
  }
  return false;
}

/**
 * Mon–Fri, plus Saturday and/or Sunday for a student who is ever taught on
 * them — in every week, not only the weeks that happen to hold a lesson.
 *
 * The weekend is a property of the STUDENT: "ukazuj to pouze pro lidi, co mají
 * výuku v ty dny o víkendu — pokud student v těch dnech nikdy mít výuku
 * nebude, neukazuj mu to". Two rules came before this one and each failed a
 * different student:
 *
 * - Mon–Fri plus a weekend day only when THAT week had a lesson on it. A
 *   combined-study student could not select their Saturday in the weeks
 *   between teaching blocks — no chip, and the agenda follows the chip.
 * - Always all seven. Every full-time student got two empty chips all
 *   semester.
 *
 * `lessonDates` is the whole stored semester (`fetchFullSemesterSchedule` keeps it all), so
 * "has this student ever got a Saturday lesson" is answerable, and answering
 * it per student settles both. The desktop grid still widens per week — see
 * `visibleDayCount` in `WeeklyCalendar/useCalendarData.ts`.
 */
export function weekDays(selectedIso: string, lessonDates: ReadonlySet<string>): Date[] {
  const monday = mondayOf(selectedIso);
  const saturday = taughtOn(lessonDates, 6);
  const sunday = taughtOn(lessonDates, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  }).filter((_, i) => i < 5 || (i === 5 && saturday) || (i === 6 && sunday));
}
