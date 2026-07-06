import { describe, it, expect } from 'vitest';
import { GradeHistorySchema } from '../gradeHistory.schema';
import type { GradeHistory } from '../../documents';

// A representative real grade history payload (mirrors what syncGradeHistory writes).
const realData: GradeHistory = {
  studium: '12345',
  fetchedAt: '2026-07-06T10:00:00.000Z',
  grades: [
    {
      period: 'ZS 2025/2026 - PEF',
      predmetId: '159410',
      courseCode: 'DSND',
      courseName: 'Algoritmizace',
      examType: 'zk',
      attempt: 1,
      gradeText: 'dobře plus (D)',
      gradeLetter: 'D',
      credits: 6,
    },
  ],
};

describe('GradeHistorySchema', () => {
  it('accepts a representative real grade history payload (never drops valid data)', () => {
    expect(GradeHistorySchema.safeParse(realData).success).toBe(true);
  });

  it('accepts unknown/future IS fields via passthrough', () => {
    const withExtra = {
      ...realData,
      futureField: 'x',
      grades: [{ ...realData.grades[0], brandNewFlag: true }],
    };
    expect(GradeHistorySchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected examType value (widened to string, no drift-drop)', () => {
    const drift = { ...realData, grades: [{ ...realData.grades[0], examType: 'new_kind' }] };
    expect(GradeHistorySchema.safeParse(drift).success).toBe(true);
  });

  it('accepts a grade entry with null attempt/credits and no gradeLetter yet', () => {
    const ungraded = {
      ...realData,
      grades: [{ ...realData.grades[0], attempt: null, credits: null, gradeLetter: '' }],
    };
    expect(GradeHistorySchema.safeParse(ungraded).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(GradeHistorySchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: grades is not an array', () => {
    expect(GradeHistorySchema.safeParse({ ...realData, grades: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: grade entry missing predmetId', () => {
    const { predmetId: _predmetId, ...noPredmetId } = realData.grades[0]!; // safe: fixed literal
    expect(GradeHistorySchema.safeParse({ ...realData, grades: [noPredmetId] }).success).toBe(
      false
    );
  });

  it('rejects genuine corruption: missing studium', () => {
    const { studium: _studium, ...noStudium } = realData;
    expect(GradeHistorySchema.safeParse(noStudium).success).toBe(false);
  });
});
