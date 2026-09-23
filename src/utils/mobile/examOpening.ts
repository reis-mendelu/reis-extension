import type { ExamSection } from '../../types/exams';
import { getSectionState } from '../../components/ExamPanel/utils';
import { formatDayMonthBare, trimHour } from './examWhen';

/**
 * Exam sections whose registration has not started yet, told apart from the
 * ones a student can actually book.
 *
 * The phone listed every non-registered section under "Otevřené termíny" —
 * including the ones IS will not let anyone near until a date in December. The
 * count in that header is the first thing read on the screen, and it was
 * counting things that could not be done: "Přidat možnost, že zkouška ještě
 * není otevřena".
 *
 * `getSectionState` has computed this all along for the desktop panel — it
 * returns `{ type: 'opening', earliest }` from the terms' own
 * `registrationStart` — and the phone simply threw the answer away. Nothing new
 * is inferred here; the existing answer is just carried through.
 */
export interface NotYetOpen<T> {
  row: T;
  /** When the earliest term opens for registration. */
  earliest: Date;
}

export function splitByRegistrationOpen<T extends { section: ExamSection }>(
  rows: readonly T[],
  now: Date
): { notYetOpen: NotYetOpen<T>[]; open: T[] } {
  const notYetOpen: NotYetOpen<T>[] = [];
  const open: T[] = [];
  for (const row of rows) {
    const state = getSectionState(row.section, now);
    // ONLY the 'opening' state moves. 'noInfo' and 'empty' say IS told us
    // nothing, which is not the same fact as "opens later" and must not be
    // dressed up as one.
    if (state.type === 'opening') notYetOpen.push({ row, earliest: state.earliest });
    else open.push(row);
  }
  notYetOpen.sort((a, b) => a.earliest.getTime() - b.earliest.getTime());
  return { notYetOpen, open };
}

/**
 * When registration opens: "1. 12. 8:00", or just "1. 12." at midnight.
 *
 * No weekday. The label's only home is the term row's trailing slot, one line
 * to the right of a date that already names the day — saying "po" twice in the
 * same row spends the width the room name needs on nothing.
 *
 * The time is dropped at exactly 00:00 because that is not a time IS meant —
 * `parseRegistrationStart` defaults a date with no clock component to midnight,
 * and IS does hand out bare dates. Printing "0:00" there invents a precision
 * the source did not have, and it reads as a typo besides.
 */
export function formatOpensAtBare(date: Date): string {
  const day = formatDayMonthBare(date);
  if (date.getHours() === 0 && date.getMinutes() === 0) return day;
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${day} ${trimHour(clock)}`;
}
