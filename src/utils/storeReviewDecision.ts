/**
 * When the phone app may ask the OS for its store-rating dialog. Pure, so the
 * whole rule is readable and tested in one place; `src/mobile/storeReview.ts`
 * stores the state and makes the call.
 *
 * Agreed 2026-11-15: only the OS's own dialog (SKStoreReviewController, Play
 * In-App Review), never a "do you like reIS?" screen in front of it that sends
 * only happy students on (Apple 5.6.1 and Google forbid that gating), never an
 * incentive, and only right after something the student came to do went
 * through. These gates are reIS's side; the OS adds its own on top and may
 * still show nothing (Apple: at most 3 times in 365 days).
 *
 * Days are Prague calendar days, `YYYY-MM-DD`, the same day the daily count
 * uses. A day count rather than a list of dates: nothing here needs to know
 * which days they were.
 */

/** The app has been opened on at least this many different days. */
export const MIN_DAYS_USED = 5;
/** …and at least this many days have passed since the first of them. */
export const MIN_DAYS_SINCE_FIRST = 7;
/** reIS asks at most once in this many days, whatever the OS would allow. */
export const ASK_COOLDOWN_DAYS = 120;
/** The file moment waits for this many files opened in reIS's reader, ever. */
export const MIN_FILES_OPENED = 3;

export interface StoreReviewState {
  /** The first day this install was counted. For an existing install that is
   *  the first day after the update that brought this code, not its install. */
  firstDay: string;
  lastDay: string;
  daysUsed: number;
  /** The day reIS last asked the OS, or null if it never has. */
  lastAskedDay: string | null;
  /** Files reIS's reader has shown, across days. Absent on a record written
   *  before files were counted, which reads as none. */
  filesOpened?: number;
}

const DAY_MS = 86_400_000;

/** Whole days from `a` to `b`; NaN when either is not a `YYYY-MM-DD` day. */
function daysFrom(a: string, b: string): number {
  const parse = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T00:00:00Z`) : NaN);
  return Math.round((parse(b) - parse(a)) / DAY_MS);
}

/** The record after the app was used on `today`. Same object if nothing changed. */
export function noteDayUsed(state: StoreReviewState | null, today: string): StoreReviewState {
  if (!state) return { firstDay: today, lastDay: today, daysUsed: 1, lastAskedDay: null };
  // Today already counted, or a clock set back: count nothing.
  if (!(daysFrom(state.lastDay, today) > 0)) return state;
  return { ...state, lastDay: today, daysUsed: state.daysUsed + 1 };
}

/** The record after the reader showed `count` more files on `today`. */
export function noteFilesOpened(
  state: StoreReviewState | null,
  today: string,
  count: number
): StoreReviewState {
  const base = state ?? noteDayUsed(null, today);
  if (!Number.isInteger(count) || count < 1) return base;
  return { ...base, filesOpened: (base.filesOpened ?? 0) + count };
}

/**
 * Whether a success moment on `today` may ask the OS for the rating dialog.
 * `needsFiles` is the file moment's extra gate: the 3rd file opened in reIS.
 */
export function shouldAskForReview(
  state: StoreReviewState | null,
  today: string,
  { needsFiles = false }: { needsFiles?: boolean } = {}
): boolean {
  if (!state) return false;
  if (state.daysUsed < MIN_DAYS_USED) return false;
  if (needsFiles && (state.filesOpened ?? 0) < MIN_FILES_OPENED) return false;
  // A comparison with NaN is false, so a garbled day refuses rather than asks.
  if (!(daysFrom(state.firstDay, today) >= MIN_DAYS_SINCE_FIRST)) return false;
  if (state.lastAskedDay === null) return true;
  return daysFrom(state.lastAskedDay, today) >= ASK_COOLDOWN_DAYS;
}

export function markAsked(state: StoreReviewState, today: string): StoreReviewState {
  return { ...state, lastAskedDay: today };
}
