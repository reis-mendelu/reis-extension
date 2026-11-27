import { parseRegistrationStart } from '../termUtils';
import { pragueToInstant } from '../examOpeningReminders';
import type { ExamSubject, ExamTerm } from '../../types/exams';

/**
 * The moment a term's registration opens, as the screens have to live it.
 *
 * IS is the authority on whether a term can be registered: the Přihlásit
 * button exists only while IS's own page carries the link (`canRegisterNow`).
 * The clock never unlocks anything. What the clock can do is tell the screen
 * WHEN to ask IS again, and what to say in the seconds between the opening
 * passing and IS's answer arriving.
 */

/** After the opening, while "IS has not shown the link yet" still reads as "about to". */
export const OPENING_GRACE_MS = 2 * 60_000;

/**
 * Asks IS again this long after the opening, then again: the first answer can
 * still come from a page rendered a second before it, or from a device clock
 * that runs ahead of IS's. Ends with the last offset — a term IS still will not
 * open after a minute is simply not bookable, and that is its answer.
 */
export const OPENING_REFRESH_OFFSETS_MS = [1_000, 5_000, 20_000, 60_000] as const;

/** An opening stays "the next one" until the last retry is behind it. */
const RETRY_WINDOW_MS = 65_000;

/** Longest delay a timer takes: `setTimeout` fires AT ONCE past 2^31 − 1 ms. */
export const MAX_TIMER_DELAY_MS = 24 * 3_600_000;

const isFull = (term: ExamTerm) =>
  !!term.full ||
  !!(term.capacity && term.capacity.occupied + (term.capacity.reserve ?? 0) >= term.capacity.total);

const startOf = (term: ExamTerm) =>
  term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;

/**
 * Registration has just opened and IS has not shown the register link (yet).
 * The row shows a neutral "opening" instead of a blank slot or "UZAVŘENO".
 * Never true once IS gave the link, nor for a term that is full, closed or that
 * the student cannot register for — those say their own thing.
 */
export function isJustOpened(term: ExamTerm, now: Date): boolean {
  if (term.canRegisterNow || term.cannotRegister || isFull(term)) return false;
  const start = startOf(term);
  if (!start) return false;
  const elapsed = now.getTime() - start.getTime();
  if (!(elapsed >= 0 && elapsed < OPENING_GRACE_MS)) return false;
  const end = term.registrationEnd ? parseRegistrationStart(term.registrationEnd) : null;
  return !(end && end.getTime() < now.getTime());
}

/**
 * The earliest opening still worth a refresh, as a timestamp: one ahead of
 * `nowMs`, or one that passed less than the retry window ago. A number, not a
 * Date, so a store selector on it changes only when the answer does.
 */
export function nextRegistrationOpening(
  subjects: readonly ExamSubject[],
  nowMs: number
): number | null {
  let next: number | null = null;
  for (const subject of subjects) {
    for (const section of subject.sections) {
      for (const term of section.terms) {
        if (term.canRegisterNow || term.cannotRegister) continue;
        // The instant IS opens it: IS writes Prague time, and a phone abroad that
        // read it in its own zone (London) asked IS again an hour after the seats went.
        // The labels still read IS's wall clock, like every other exam time on screen.
        const wall = startOf(term);
        const start = wall ? pragueToInstant(wall).getTime() : undefined;
        if (start === undefined || Number.isNaN(start) || start <= nowMs - RETRY_WINDOW_MS)
          continue;
        if (next === null || start < next) next = start;
      }
    }
  }
  return next;
}
