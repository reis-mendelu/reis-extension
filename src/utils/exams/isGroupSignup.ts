import type { ExamSection } from '../../types/exams';

/**
 * Is this "section" actually a seminar-group signup rather than an exam?
 *
 * IS Mendelu serves seminar-group signup through the very same
 * `terminy_seznam.pl` table as exam terms, with `Druh` reading "Zápis na
 * cvičení" and real `prihlasit_ihned=1` links on every row. The parser is
 * right to pick those up — they are genuine, bookable IS terms. They are just
 * not exams.
 *
 * Two reports pull in opposite directions, and the answer serves both:
 *
 * - #344: a student whose group was assigned up front never registered through
 *   a termín, so the section can never reach `status: 'registered'`. Under
 *   "Otevřené termíny", with a badge, it read as an obligation he had not met.
 * - Report #37: hiding them entirely (what #344 did) cost a student her ZOO
 *   Vyškov excursion — a dated, real term she could see in IS and not in reIS.
 *
 * So a signup is shown, but only in its own collapsed group at the bottom of
 * Zkoušky (`buildSignupExams`, the desktop `useExamsData().signupSections`),
 * never in the exam groups, never in the menu badge, and never in a deadline
 * alert or opening reminder. Registered, it shows as registered like an exam.
 *
 * Matching is on the CZECH name on purpose. Both language fetches merge into
 * one section object (`fetchDualLanguageExams`), so the Czech druh is present
 * whichever language the UI is showing, and we never have to guess at IS's
 * English wording for a string we have no sample of.
 */
export function isGroupSignupSection(section: ExamSection): boolean {
  const czech = section.nameCs || section.name || '';
  // Strip diacritics before comparing: IS is not consistent about them, and
  // "zapis" must not be allowed to drift away from "zápis".
  const normalized = czech
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  // Anchored prefix, and the trailing space is deliberate. We have exactly one
  // observed druh string and no catalogue of the rest, so the filter is written
  // to under-match rather than over-match: a signup we fail to recognise is a
  // visible row someone reports, while a druh we wrongly eat disappears from
  // the whole app with no error. "Zápis na " covers the reported case and
  // "Zápis na seminář" without reaching a one-word druh we have never seen.
  return normalized.startsWith('zapis na ');
}
