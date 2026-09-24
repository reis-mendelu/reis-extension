import type { ExamSection, ExamTerm } from '../../types/exams';
import { parseRegistrationStart } from '../termUtils';

export type TermDeadlineKind = 'deregisterUntil' | 'registerUntil' | 'registerFrom';

export interface TermDeadline {
  kind: TermDeadlineKind;
  /** The raw IS string, "DD.MM.YYYY HH:MM" — formatted by the caller. */
  value: string;
}

/**
 * The one registration date a term's row should show, chosen by what the
 * student can do about it:
 *
 *   on this term  → until when they can still get OFF it
 *   anything else → until when they can still get ON it: the deadline they
 *                   have to beat, whether registration is open, shut, or has
 *                   not started (the row's own slot says "otevírá se …" there,
 *                   so repeating the opening moment here said nothing new)
 *
 * Only a term with no closing moment at all falls back to the opening one.
 *
 * Showing every date IS has is what this replaced: "Přihlášení do" beside
 * "Odhlášení do" on a term the student is not on says nothing they can act on,
 * and on a phone it is half the panel.
 */
export function termDeadline(
  term: ExamTerm,
  section: ExamSection,
  isRegHere: boolean,
  now: Date
): TermDeadline | null {
  if (isRegHere) {
    const until = term.deregistrationDeadline ?? section.registeredTerm?.deregistrationDeadline;
    return until ? { kind: 'deregisterUntil', value: until } : null;
  }

  if (term.registrationEnd) return { kind: 'registerUntil', value: term.registrationEnd };
  // Only where IS gave no closing moment: otherwise the row's trailing slot
  // already says "otevírá se …", and the panel would repeat it.
  const opensAt = term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;
  if (opensAt && opensAt.getTime() > now.getTime() && term.registrationStart) {
    return { kind: 'registerFrom', value: term.registrationStart };
  }
  return null;
}
