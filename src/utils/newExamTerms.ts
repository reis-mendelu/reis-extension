import type { ExamSubject } from '../types/exams';

/** A term's identity across syncs: IS's own term id under its subject and section. */
export const examTermKey = (courseCode: string, sectionId: string, termId: string): string =>
  `${courseCode}\u0000${sectionId}\u0000${termId}`;

export interface NewExamTerm {
  key: string;
  courseCode: string;
  subjectCs: string;
  subjectEn: string;
  date: string;
  time: string;
}

/**
 * Every term of a list, whatever its section's state: a term the student has
 * seen stays seen after they register and deregister, or after IS moves it
 * to "Kam se přihlásit nemohu?".
 */
export function allTermKeys(exams: readonly ExamSubject[]): string[] {
  return exams.flatMap((s) =>
    s.sections.flatMap((sec) => sec.terms.map((t) => examTermKey(s.code, sec.id, t.id)))
  );
}

/**
 * The terms of a fresh list this device has not seen, that the student could
 * still register for.
 *
 * Nothing without a known record: the first sync after install would
 * otherwise announce every term of the exam period. A known record with no ids
 * is still a record, so the first term that appears after an empty list is
 * news. A section the student is registered in is not announced: they have
 * their term.
 */
export function findNewTerms(
  known: ReadonlySet<string> | undefined,
  fresh: readonly ExamSubject[]
): NewExamTerm[] {
  if (!known) return [];
  return fresh.flatMap((s) =>
    s.sections
      .filter((sec) => sec.status !== 'registered')
      .flatMap((sec) =>
        sec.terms
          .filter((t) => !t.cannotRegister && !known.has(examTermKey(s.code, sec.id, t.id)))
          .map((t) => ({
            key: examTermKey(s.code, sec.id, t.id),
            courseCode: s.code,
            subjectCs: s.nameCs ?? s.name,
            subjectEn: s.nameEn ?? s.name,
            date: t.date,
            time: t.time,
          }))
      )
  );
}
