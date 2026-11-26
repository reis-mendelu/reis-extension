// Prague time, shared by the overview's "upcoming" (IS items and ledger entries). IS prints
// DD.MM.YYYY and HH:MM in Prague time whatever the computer's clock is set to, and a student's
// day ends at Prague midnight, so every "days left" is counted on Prague's calendar.
export const DAY = 86_400_000;

const ZONE = 'Europe/Prague';
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** The Prague wall clock at `at`, as the UTC instant that shows the same numbers. */
export function pragueWall(at: number): number {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

/** The Prague calendar day of `at`, as UTC midnight of that day. */
export const pragueToday = (at: number) => Math.floor(pragueWall(at) / DAY) * DAY;

/**
 * `at` as a local timestamp that reads the Prague wall clock: what src's isBoxOpen needs, since it
 * builds a deadline from IS's Prague numbers in the computer's own zone.
 */
export function pragueAsLocal(at: number): number {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return new Date(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!).getTime();
}

/**
 * IS prints DD.MM.YYYY and, for a term or a deadline, HH:MM, in Prague time whatever the
 * computer's clock is set to. Returns the instant and the Prague calendar day (as UTC midnight).
 * Without a time the day ends at 23:59, which is how a deadline reads.
 */
export function parsePrague(date: string, time = ''): { at: number; day: number } | null {
  const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(
    `${date} ${time}`.trim()
  );
  if (!m) return null;
  const wall = Date.UTC(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    Number(m[4] ?? 23),
    Number(m[5] ?? 59)
  );
  // Subtract Prague's offset at that moment; once more, in case the first guess crossed a clock change.
  let at = wall - (pragueWall(wall) - wall);
  at = wall - (pragueWall(at) - at);
  return { at, day: Math.floor(wall / DAY) * DAY };
}
