const PRAGUE_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Prague as YYYY-MM-DD. The past/future line of the sync. */
export function pragueToday(now: Date = new Date()): string {
  return PRAGUE_DAY.format(now);
}

/**
 * The window reIS holds lessons for. MUST stay identical to
 * `src/services/sync/syncSchedule.ts` and `src/injector/dataFetchers.ts`.
 */
export function academicWindow(now: Date = new Date()): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 8) return { start: new Date(y, 8, 1), end: new Date(y + 1, 7, 31) };
  if (m <= 1) return { start: new Date(y - 1, 8, 1), end: new Date(y, 7, 31) };
  return { start: new Date(y, 1, 1), end: new Date(y, 7, 31) };
}
