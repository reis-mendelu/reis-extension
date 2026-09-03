/**
 * Which days the phone's day strip shows, and the date arithmetic around it.
 *
 * Lifted out of `DayChips` because the strip is no longer the only thing that
 * needs the answer: the screen header now labels the week the strip is showing,
 * and two independent computations of "which week is this" is precisely how the
 * strip and the header came to disagree the first time — the row was anchored
 * to `schedule.weekStart`, which `syncSchedule` writes as the semester start,
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

/**
 * Mon–Fri, plus any weekend day that actually holds a lesson.
 *
 * MENDELU teaches combined-study cohorts on Saturdays and the desktop grid
 * carries all seven days, so a fixed five made those lessons unreachable: the
 * agenda follows the selected day and no chip could select a Saturday. An empty
 * weekend never pads the strip, so the common week stays five even chips.
 */
export function weekDays(selectedIso: string, lessonDates: ReadonlySet<string>): Date[] {
  const monday = mondayOf(selectedIso);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  }).filter((date, i) => i < 5 || lessonDates.has(toCompact(toIso(date))));
}
