import { describe, it, expect, vi, afterEach } from 'vitest';
import { selectEnrolledNow, enrolledSemester } from '../enrolledSubjects';
import type { EnrolledSubject } from '../enrolledSubjects';
import type { StudyPlan, SubjectStatus } from '../../../types/studyPlan';

function subject(over: Partial<SubjectStatus> = {}): SubjectStatus {
  return {
    id: over.id ?? '1',
    code: over.code ?? 'EBC-ALG',
    name: over.name ?? 'Algoritmizace',
    credits: over.credits ?? 5,
    type: over.type ?? 'povinný',
    isEnrolled: over.isEnrolled ?? false,
    isFulfilled: over.isFulfilled ?? false,
    enrollmentCount: over.enrollmentCount ?? 0,
    fulfillmentDate: over.fulfillmentDate,
    rawStatusText: over.rawStatusText ?? '',
  };
}

function plan(blocks: { title: string; subjects: SubjectStatus[] }[]): StudyPlan {
  return {
    creditsAcquired: 0,
    creditsRequired: 180,
    blocks: blocks.map((b) => ({
      title: b.title,
      groups: [{ name: 'Povinné', statusDescription: '', subjects: b.subjects }],
    })),
  } as StudyPlan;
}

/**
 * What the student CHOSE, not what the plan offers.
 *
 * The phone read its subject list off a study-plan block — the curriculum for a
 * semester — so a block offering a choice between two courses listed BOTH. A
 * student enrolled in Java saw Java and C++ side by side, and neither was
 * marked as the one they actually take. Reported from the iPad against the
 * browser extension, which has shown the enrolled set all along
 * (`EnrolledNowSection`, `isEnrolled && !isFulfilled`).
 *
 * Picking the block at all is the other half of the bug: `getSemesterState`
 * infers "current" from enrolment and fulfilment across the whole block, so a
 * student who has not registered yet gets whichever block its heuristics land
 * on — reported as "I see the 4th semester subject instead of my 3rd". Reading
 * the enrolments directly needs no such guess.
 */
describe('selectEnrolledNow', () => {
  afterEach(() => vi.useRealTimers());

  it('takes the subject the student enrolled in and leaves the alternative behind', () => {
    const java = subject({ id: '1', code: 'EBC-JAVA', name: 'Java', isEnrolled: true });
    const cpp = subject({ id: '2', code: 'EBC-CPP', name: 'C++' });
    const result = selectEnrolledNow(plan([{ title: '3. semestr', subjects: [java, cpp] }]));
    expect(result.map((r) => r.subject.name)).toEqual(['Java']);
  });

  it('does not care which plan block the enrolment sits in', () => {
    // The heuristic that used to choose a block is gone: an enrolment in the
    // 3rd semester's block is returned even when a later block would have
    // scored as "current".
    const enrolled = subject({ code: 'EBC-STAT', name: 'Statistika', isEnrolled: true });
    const fourth = subject({ code: 'EBC-DIP', name: 'Diplomový seminář' });
    const result = selectEnrolledNow(
      plan([
        { title: '3. semestr', subjects: [enrolled] },
        { title: '4. semestr', subjects: [fourth] },
      ])
    );
    expect(result.map((r) => r.subject.name)).toEqual(['Statistika']);
    expect(result[0]!.semester).toBe(3);
  });

  it('returns nothing when the student has enrolled in nothing', () => {
    // Better an honest empty than a semester picked by inference — this is the
    // state the reporter was in ("maybe that's because I haven't signed up for
    // the subjects yet"), and it used to produce a wrong answer with no hint
    // that it was a guess.
    const result = selectEnrolledNow(
      plan([{ title: '3. semestr', subjects: [subject({ code: 'A' }), subject({ code: 'B' })] }])
    );
    expect(result).toEqual([]);
  });

  it('keeps a subject passed THIS semester, marked done', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    const passed = subject({
      code: 'EBC-MAT',
      name: 'Matematika',
      isFulfilled: true,
      enrollmentCount: 1,
      fulfillmentDate: '14.03.2026',
    });
    const result = selectEnrolledNow(plan([{ title: '3. semestr', subjects: [passed] }]));
    expect(result.map((r) => [r.subject.name, r.done])).toEqual([['Matematika', true]]);
  });

  it('drops a subject passed in an earlier semester', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    const old = subject({
      code: 'EBC-OLD',
      name: 'Úvod do studia',
      isFulfilled: true,
      enrollmentCount: 1,
      fulfillmentDate: '14.01.2025',
    });
    expect(selectEnrolledNow(plan([{ title: '1. semestr', subjects: [old] }]))).toEqual([]);
  });

  it('marks an enrolled, unfinished subject as not done', () => {
    const java = subject({ code: 'EBC-JAVA', name: 'Java', isEnrolled: true });
    const result = selectEnrolledNow(plan([{ title: '3. semestr', subjects: [java] }]));
    expect(result[0]!.done).toBe(false);
  });

  it('skips zaměření placeholders, which are not courses', () => {
    const z = subject({ code: 'EBC-ZB01', name: 'Zaměření: Ekonomika', isEnrolled: true });
    const real = subject({ code: 'EBC-JAVA', name: 'Java', isEnrolled: true });
    const result = selectEnrolledNow(plan([{ title: '3. semestr', subjects: [z, real] }]));
    expect(result.map((r) => r.subject.name)).toEqual(['Java']);
  });

  it('lists a subject once even when the plan repeats it across blocks', () => {
    const java = subject({ code: 'EBC-JAVA', name: 'Java', isEnrolled: true });
    const result = selectEnrolledNow(
      plan([
        { title: '3. semestr', subjects: [java] },
        { title: '5. semestr', subjects: [{ ...java }] },
      ])
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.semester).toBe(3);
  });

  it('has no semester number when the block title carries none', () => {
    const java = subject({ code: 'EBC-JAVA', name: 'Java', isEnrolled: true });
    const result = selectEnrolledNow(plan([{ title: 'Volitelné předměty', subjects: [java] }]));
    expect(result[0]!.semester).toBeNull();
  });
});

/**
 * Which semester the header names. Neither the lowest nor the highest enrolled
 * semester survives contact with an ordinary student: both of the cases below
 * happen every year, and they pull in opposite directions.
 */
describe('enrolledSemester', () => {
  const at = (semester: number | null): EnrolledSubject => ({
    subject: subject(),
    semester,
    done: false,
  });

  it('is null when nothing carries a semester number', () => {
    expect(enrolledSemester([at(null), at(null)])).toBeNull();
  });

  it('ignores one retaken course from an earlier semester', () => {
    // 3rd-semester student repeating a 1st-semester course they failed.
    expect(enrolledSemester([at(1), at(3), at(3), at(3), at(3)])).toBe(3);
  });

  it('ignores one elective picked up early from a later semester', () => {
    // The same student, one 4th-semester elective taken ahead of time.
    expect(enrolledSemester([at(3), at(3), at(3), at(4)])).toBe(3);
  });

  it('keeps the lower semester when the split is even', () => {
    // Half and half means the earlier one is not finished yet.
    expect(enrolledSemester([at(3), at(4)])).toBe(3);
  });

  it('skips unnumbered blocks rather than letting them win', () => {
    expect(enrolledSemester([at(null), at(null), at(2)])).toBe(2);
  });
});
