import type { CourseGrade } from '../../types/documents';
import type { ExamTerm } from '../../types/exams';

/**
 * Whether a registration is the student's first attempt (řádný), for the
 * store-rating moment: a resit is never a moment, because someone who just
 * failed an exam is the likeliest 1★ (Dominik, 2026-11-15).
 *
 * The term alone cannot say. IS lists most terms as BOTH řádný and opravný
 * (8 of 11 terms in a real snapshot, Nov 2026), so which attempt this is lives
 * in the student's own grade history: an F for the subject means a resit. The
 * subject is found by predmet id or by code, as `gradeForCourse` does.
 *
 * Conservative where it cannot know: with no grade history loaded, only a term
 * IS marks as řádný and nothing else counts.
 */
export function isFirstAttemptRegistration({
  attemptTypes,
  grades,
  courseCode,
  predmetId,
}: {
  attemptTypes: ExamTerm['attemptTypes'];
  grades: CourseGrade[] | null;
  courseCode: string;
  predmetId?: string;
}): boolean {
  if (attemptTypes && !attemptTypes.includes('regular')) return false;
  if (grades === null) {
    return !!attemptTypes && attemptTypes.every((t) => t === 'regular');
  }
  const failed = grades.some(
    (g) =>
      g.gradeLetter === 'F' &&
      ((!!predmetId && g.predmetId === predmetId) || (!!courseCode && g.courseCode === courseCode))
  );
  return !failed;
}
