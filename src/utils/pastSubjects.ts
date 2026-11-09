import type { StudyPlan, DualLanguageStudyPlan } from '../types/studyPlan';
import { isThisSemester } from '../components/SubjectsPanel/utils';

/**
 * Subjects the study plan positively places in an EARLIER semester — the one
 * rule every notification kind follows: reIS never notifies about a subject
 * the student is not taking this semester (decided 2026-11-07).
 *
 * Negative evidence on purpose, not "is it enrolled now". The store's plan
 * comes from IndexedDB, so until a launch's first sync refreshes it the one in
 * hand can be last semester's — and that lists the new semester's subjects as
 * never enrolled. An allow-list would silence all of those, and a student with
 * no usable plan (exchange students, a failed fetch) would get nothing at all.
 * So only a row that says "taken before, not now" counts:
 *
 *  - passed, but not this semester (`isThisSemester` — a winter subject passed
 *    in January is this semester's until February starts the summer one),
 *    recognised subjects (no attempt) included, or
 *  - enrolled at some point (`enrollmentCount > 0`) and neither enrolled now
 *    nor passed: a failed attempt not taken again.
 *
 * The one case a stale plan gets wrong is that second one being retaken: it
 * reads as past until the plan refreshes. Nothing is lost for it: the new
 * points notification reads this run's plan (useAppLogic), exam reminders
 * reconcile when the plan changes, and Novinky recomputes.
 *
 * Anything enrolled now stays — a winter subject still unpassed in its
 * January–February exam period included. So does a code the plan does not
 * list, one never enrolled, and everything when there is no plan: unknown is
 * not past.
 */
export function pastSubjectCodes(plan: StudyPlan | null | undefined): Set<string> {
  const past = new Set<string>();
  const current = new Set<string>();
  for (const block of plan?.blocks ?? []) {
    for (const group of block.groups) {
      for (const s of group.subjects) {
        if (!s.code) continue;
        if (s.isEnrolled || (s.isFulfilled && isThisSemester(s.fulfillmentDate))) {
          current.add(s.code);
        } else if (s.isFulfilled || s.enrollmentCount > 0) {
          past.add(s.code);
        }
      }
    }
  }
  // IS repeats a subject across blocks; a retake is enrolled again. Any row
  // saying "now" outweighs one saying "before".
  for (const code of current) past.delete(code);
  return past;
}

/** The plan in the store, in whichever language is there (enrolments are the same). */
export function pastSubjectCodesOf(dual: DualLanguageStudyPlan | null | undefined): Set<string> {
  return pastSubjectCodes(dual?.cz ?? dual?.en);
}

/** False for an unknown code: only what the plan says is past is suppressed. */
export function isPastSubject(past: Set<string>, code: string | null | undefined): boolean {
  return !!code && past.has(code);
}

/**
 * A subject code for an IS predmet id (cvičné testy, boxes). The subjects
 * store keeps past subjects under the id of the period they were taken in —
 * the id changes per period, the code does not, so the code is what is tested.
 */
export function codeForCourseId(
  courseId: string | null | undefined,
  subjects: Record<string, { subjectId?: string }> | undefined
): string | null {
  if (!courseId) return null;
  const match = Object.entries(subjects ?? {}).find(([, s]) => s.subjectId === courseId);
  return match?.[0] ?? null;
}

/** A code-keyed map (new záznamník points) without the past subjects. */
export function withoutPastSubjects<T>(
  byCode: Record<string, T>,
  past: Set<string>
): Record<string, T> {
  return Object.fromEntries(Object.entries(byCode).filter(([code]) => !past.has(code)));
}
