import type { ExamSubject, ExamSection, ExamTerm } from '../types/exams';

/**
 * True if any subject has a non-registered section containing a term the student
 * can register for right now (open registration link, not full). This is the
 * canonical "actionable exam registration exists" predicate — mirrors the badge
 * logic in useMenuItems and gates the calendar's exam-period handoff banner.
 */
export function hasRegisterableTerms(exams: ExamSubject[]): boolean {
    return exams.some((sub: ExamSubject) =>
        sub.sections.some((sec: ExamSection) =>
            sec.status !== 'registered' &&
            sec.terms.some((term: ExamTerm) => !term.full && term.canRegisterNow === true)
        )
    );
}
