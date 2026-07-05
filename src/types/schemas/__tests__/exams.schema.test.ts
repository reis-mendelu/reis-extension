import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ExamSubjectSchema } from '../exams.schema';
import type { ExamSubject } from '../../exams';

const ExamsSchema = z.array(ExamSubjectSchema);

// A representative real exam subject (mirrors what syncExams writes).
const realSubject: ExamSubject = {
  version: 1,
  id: 'EBC-ALG',
  name: 'Algebra',
  nameCs: 'Algebra',
  nameEn: 'Algebra',
  code: 'EBC-ALG',
  sections: [
    {
      id: 's1',
      name: 'zkouška',
      type: 'exam',
      status: 'available',
      terms: [
        {
          id: 't1',
          date: '12.06.2026',
          time: '09:00',
          capacity: { occupied: 10, total: 20, raw: '10/20' },
          room: 'Q01',
          attemptTypes: ['regular', 'retake1'],
        },
      ],
    },
  ],
};

describe('ExamSubjectSchema', () => {
  it('accepts a representative real exam subject (never drops valid data)', () => {
    expect(ExamsSchema.safeParse([realSubject]).success).toBe(true);
  });

  it('accepts unknown/future IS fields via passthrough', () => {
    const withExtra = {
      ...realSubject,
      futureField: 'x',
      sections: [{ ...realSubject.sections[0], brandNewFlag: true }],
    };
    expect(ExamSubjectSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected section.status value (widened to string, no drift-drop)', () => {
    const drift = {
      ...realSubject,
      sections: [{ ...realSubject.sections[0], status: 'brand_new_status' }],
    };
    expect(ExamSubjectSchema.safeParse(drift).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(ExamSubjectSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: sections is not an array', () => {
    expect(ExamSubjectSchema.safeParse({ ...realSubject, sections: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: missing id', () => {
    const { id: _id, ...noId } = realSubject;
    expect(ExamSubjectSchema.safeParse(noId).success).toBe(false);
  });
});
