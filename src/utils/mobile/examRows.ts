import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';

/** The registered term as IS models it — a narrower shape than `ExamTerm`
 *  (no capacity, optional id), so it gets its own alias rather than a cast. */
type RegisteredTerm = NonNullable<ExamSection['registeredTerm']>;
import { parseCzechDateTime } from './examTimeline';

export interface RegisteredExam {
  subject: ExamSubject;
  section: ExamSection;
  /** The term the student is signed up for. */
  term: RegisteredTerm;
  date: Date;
  subjectName: string;
  sectionName: string;
}

export interface OpenExam {
  subject: ExamSubject;
  section: ExamSection;
  subjectName: string;
  sectionName: string;
}

function localized(
  cs: string | undefined,
  en: string | undefined,
  fallback: string,
  language: string
): string {
  return language === 'en' && en ? en : cs || fallback;
}

/**
 * The registered exams as flat rows, nearest first, each with its term date
 * already parsed.
 *
 * Sections whose registered term carries an unparseable date are dropped rather
 * than sorted to the front as Invalid Dates — IS occasionally emits placeholder
 * text where a date should be, and one bad row must not reorder the screen.
 */
export function buildRegisteredExams(exams: ExamSubject[], language: string): RegisteredExam[] {
  const rows: RegisteredExam[] = [];
  for (const subject of exams) {
    for (const section of subject.sections) {
      if (section.status !== 'registered') continue;
      const term = section.registeredTerm;
      if (!term) continue;
      const date = parseCzechDateTime(term.date, term.time);
      if (!date) continue;
      rows.push({
        subject,
        section,
        term,
        date,
        subjectName: localized(subject.nameCs, subject.nameEn, subject.name, language),
        sectionName: localized(section.nameCs, section.nameEn, section.name, language),
      });
    }
  }
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Everything not registered — the "open slots" group, in catalog order. */
export function buildOpenExams(exams: ExamSubject[], language: string): OpenExam[] {
  const rows: OpenExam[] = [];
  for (const subject of exams) {
    for (const section of subject.sections) {
      if (section.status === 'registered') continue;
      rows.push({
        subject,
        section,
        subjectName: localized(subject.nameCs, subject.nameEn, subject.name, language),
        sectionName: localized(section.nameCs, section.nameEn, section.name, language),
      });
    }
  }
  return rows;
}

/** Slots still free on a term, or null when IS reported no capacity at all. */
export function freeSeats(term: ExamTerm): { free: number; total: number } | null {
  const cap = term.capacity;
  if (!cap || typeof cap.total !== 'number') return null;
  return { free: Math.max(0, cap.total - (cap.occupied ?? 0)), total: cap.total };
}
