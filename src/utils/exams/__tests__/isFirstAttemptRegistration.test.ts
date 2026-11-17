import { describe, it, expect } from 'vitest';
import { isFirstAttemptRegistration } from '../isFirstAttemptRegistration';
import type { CourseGrade } from '../../../types/documents';

const grade = (over: Partial<CourseGrade>): CourseGrade => ({
  period: 'ZS 2025/2026 - PEF',
  predmetId: '164226',
  courseCode: 'EBC-MNG',
  courseName: 'Management',
  examType: 'zk',
  attempt: 1,
  gradeText: '',
  gradeLetter: '',
  credits: 5,
  ...over,
});

const subject = { courseCode: 'EBC-MNG', predmetId: '164226' };

describe('isFirstAttemptRegistration', () => {
  it('a regular-only term with no grade on record is a first attempt', () => {
    expect(isFirstAttemptRegistration({ ...subject, attemptTypes: ['regular'], grades: [] })).toBe(
      true
    );
  });

  it('a retake-only term never is', () => {
    expect(isFirstAttemptRegistration({ ...subject, attemptTypes: ['retake1'], grades: [] })).toBe(
      false
    );
  });

  // IS lists most terms as BOTH řádný and opravný (8 of 11 in a real snapshot),
  // so the term cannot say which attempt this student is on: their grades can.
  it('a mixed term is a first attempt when the subject has no F', () => {
    expect(
      isFirstAttemptRegistration({ ...subject, attemptTypes: ['regular', 'retake1'], grades: [] })
    ).toBe(true);
  });

  it('a mixed term is a resit when the subject already has an F', () => {
    expect(
      isFirstAttemptRegistration({
        ...subject,
        attemptTypes: ['regular', 'retake1'],
        grades: [grade({ gradeLetter: 'F', gradeText: 'nedostatečně (F)' })],
      })
    ).toBe(false);
  });

  it('even a regular-only term is skipped after an F (a repeated subject)', () => {
    expect(
      isFirstAttemptRegistration({
        ...subject,
        attemptTypes: ['regular'],
        grades: [grade({ gradeLetter: 'F' })],
      })
    ).toBe(false);
  });

  it('finds the F by predmet id when the code column differs', () => {
    expect(
      isFirstAttemptRegistration({
        ...subject,
        attemptTypes: ['regular', 'retake1'],
        grades: [grade({ courseCode: 'MNG', gradeLetter: 'F' })],
      })
    ).toBe(false);
  });

  it("another subject's F does not count", () => {
    expect(
      isFirstAttemptRegistration({
        ...subject,
        attemptTypes: ['regular', 'retake1'],
        grades: [grade({ predmetId: '999', courseCode: 'EBC-ALG', gradeLetter: 'F' })],
      })
    ).toBe(true);
  });

  it('without grade history, only a regular-only term counts', () => {
    expect(
      isFirstAttemptRegistration({ ...subject, attemptTypes: ['regular'], grades: null })
    ).toBe(true);
    expect(
      isFirstAttemptRegistration({ ...subject, attemptTypes: ['regular', 'retake1'], grades: null })
    ).toBe(false);
  });

  it('a term IS marked with no attempt type counts only with grade history', () => {
    expect(isFirstAttemptRegistration({ ...subject, attemptTypes: undefined, grades: [] })).toBe(
      true
    );
    expect(isFirstAttemptRegistration({ ...subject, attemptTypes: undefined, grades: null })).toBe(
      false
    );
  });
});
