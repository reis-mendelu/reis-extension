import type { StudyPlan, SubjectStatus } from '../../types/studyPlan';
import { isZameraniCode, isThisSemester } from '../../components/SubjectsPanel/utils';

export interface EnrolledSubject {
  subject: SubjectStatus;
  /** The plan block's semester number, or null when its title carries none. */
  semester: number | null;
  /** Already passed, this semester. Enrolled-but-unfinished subjects are false. */
  done: boolean;
}

/**
 * What the student is actually taking this semester.
 *
 * The phone used to answer this with a study-plan BLOCK — `plan.blocks.find(b =>
 * getSemesterState(b) === 'current')` — and a block is the curriculum, not the
 * enrolment. Two reported bugs came out of that one substitution:
 *
 *  - A block that offers a choice lists every option, so a student enrolled in
 *    Java saw Java *and* C++, with nothing to say which one was theirs.
 *  - Choosing the block at all is a guess. `getSemesterState` infers "current"
 *    from enrolment and fulfilment across the whole block, so a student who has
 *    not registered yet gets whichever block the heuristics land on — reported
 *    as "I see the 4th semester subject instead of my 3rd".
 *
 * Reading the enrolments directly removes the guess: `isEnrolled` is IS's own
 * answer to "did you sign up for this", so no inference is needed and no
 * alternative can leak in. This is what the browser extension has always done
 * (`SubjectsPanel/EnrolledNowSection`), which is why the two clients disagreed
 * — the logic is deliberately the same shape as that one.
 *
 * Subjects passed THIS semester come back too, marked `done`: they are part of
 * the semester the student is in, and they are what makes a "3 of 5 done"
 * count mean anything. One passed last year is not.
 */
export function selectEnrolledNow(plan: StudyPlan | null | undefined): EnrolledSubject[] {
  if (!plan) return [];
  const out: EnrolledSubject[] = [];
  // First block wins: IS repeats a subject across blocks when a plan allows it
  // to count in more than one, and the earliest is the one the student is
  // taking it for.
  const seen = new Set<string>();

  for (const block of plan.blocks) {
    const match = block.title.match(/^(\d+)/);
    const semester = match ? Number(match[1]) : null;
    for (const group of block.groups) {
      for (const subject of group.subjects) {
        // Zaměření rows are plan placeholders standing in for a whole
        // specialisation, not courses anyone attends.
        if (isZameraniCode(subject.code)) continue;
        if (seen.has(subject.code)) continue;

        if (subject.isEnrolled && !subject.isFulfilled) {
          seen.add(subject.code);
          out.push({ subject, semester, done: false });
        } else if (
          subject.isFulfilled &&
          // enrollmentCount guards against a subject RECOGNISED rather than
          // sat (uznaný předmět), which carries a fulfillment date it was
          // never enrolled for.
          subject.enrollmentCount > 0 &&
          isThisSemester(subject.fulfillmentDate)
        ) {
          seen.add(subject.code);
          out.push({ subject, semester, done: true });
        }
      }
    }
  }

  return out;
}

/**
 * The semester the enrolments say the student is in: the one MOST of them
 * belong to, ties broken by the lower number.
 *
 * Not the lowest and not the highest, because each is wrong in an ordinary
 * case. A student in their 3rd semester retaking one failed 1st-semester
 * course has enrolments in {1, 3}, and the lowest would file them under the
 * course they are repeating. A student in their 3rd who has picked up one 4th
 * semester elective early has {3, 4}, and the highest would push them a
 * semester ahead. The bulk of anyone's enrolments sit in the semester they are
 * actually in, so the mode survives both.
 *
 * Null when nothing carries a number (a plan whose block titles are not
 * numbered — "Volitelné předměty" and the like).
 */
export function enrolledSemester(enrolled: EnrolledSubject[]): number | null {
  const counts = new Map<number, number>();
  for (const { semester } of enrolled) {
    if (semester === null) continue;
    counts.set(semester, (counts.get(semester) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  // Ascending, so an equal count keeps the lower semester: with a 3/4 split
  // down the middle the student has not finished the earlier one yet.
  for (const semester of [...counts.keys()].sort((a, b) => a - b)) {
    const count = counts.get(semester)!;
    if (count > bestCount) {
      best = semester;
      bestCount = count;
    }
  }
  return best;
}
