import type { ExamSection, ExamSubject } from '../../types/exams';

/**
 * Is this "section" actually a seminar-group signup rather than an exam?
 *
 * IS Mendelu serves seminar-group signup through the very same
 * `terminy_seznam.pl` table as exam terms, with `Druh` reading "Zápis na
 * cvičení" and real `prihlasit_ihned=1` links on every row. The parser is
 * right to pick those up — they are genuine, bookable IS terms. They are just
 * not exams, and a screen titled "Zkoušky" is the wrong place for them.
 *
 * Why this matters beyond tidiness: a student whose group was assigned up front
 * never registered through a termín, so the row can never appear in IS's
 * `#table_1` and the section can never reach `status: 'registered'`. It sits
 * under "Otevřené termíny" forever, reading as an obligation the student has
 * not met. That is what reached us — a first-year asking whether he had to act
 * on a cvičení he was already sitting in.
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

/**
 * The exam data with seminar-group signup taken out.
 *
 * Applied where exam data ENTERS the store, so that no consumer has to know
 * about this at all. That matters because "is it an exam?" is asked in more
 * places than the Zkoušky screen: the menu badge counts registerable sections
 * (hooks/ui/useMenuItems), the weekly calendar turns registered terms into
 * lesson blocks (components/WeeklyCalendar/useCalendarData), and the phone's
 * timeline puts a dot on each one (utils/mobile/examTimeline). Filtering at the
 * screen would have left a student still being badged about a cvičení he was
 * already sitting in — which is the complaint we actually got.
 *
 * Subjects are kept even when the signup was their only section: an exam
 * subject with no sections renders nothing, and dropping the subject outright
 * would be a wider change than this fix needs.
 */
export function stripGroupSignupSections(exams: ExamSubject[]): ExamSubject[] {
  if (!Array.isArray(exams)) return [];
  return exams.map((subject) => {
    // The IndexedDB cache is written by whatever build ran last, so a subject
    // here can be any shape. Throwing would be caught by fetchExams and shown
    // to the student as an error screen with no exams at all — far worse than
    // the row this filter exists to remove.
    if (!subject || !Array.isArray(subject.sections)) return subject;
    const sections = subject.sections.filter((s) => !isGroupSignupSection(s));
    // Same array length means nothing was a signup — hand back the original
    // object so an untouched sync does not invalidate every memo downstream.
    return sections.length === subject.sections.length ? subject : { ...subject, sections };
  });
}
