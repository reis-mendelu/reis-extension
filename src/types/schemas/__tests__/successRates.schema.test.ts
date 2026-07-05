import { describe, it, expect } from 'vitest';
import {
  SuccessRatesSchema,
  SubjectSuccessRateSchema,
  SuccessRateDataSchema,
} from '../successRates.schema';
import type { SubjectSuccessRate, SuccessRateData } from '../../documents';

// A representative real subject success rate (mirrors what successRate.ts writes).
const realSubjectRate: SubjectSuccessRate = {
  courseCode: 'EBC-ALG',
  lastUpdated: '2026-07-06T10:00:00.000Z',
  predmetId: '160301',
  stats: [
    {
      semesterName: 'ZS 2025/2026',
      semesterId: '801',
      year: 2025,
      totalPass: 80,
      totalFail: 20,
      type: 'exam',
      terms: [
        {
          term: '1',
          grades: { A: 10, B: 20, C: 20, D: 15, E: 10, F: 5, FN: 5 },
          pass: 75,
          fail: 15,
        },
      ],
    },
  ],
};

const realAggregate: SuccessRateData = {
  lastUpdated: '2026-07-06T10:00:00.000Z',
  data: { 'EBC-ALG': realSubjectRate },
};

describe('SubjectSuccessRateSchema', () => {
  it('accepts a representative real subject success rate (never drops valid data)', () => {
    expect(SubjectSuccessRateSchema.safeParse(realSubjectRate).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    const withExtra = {
      ...realSubjectRate,
      futureField: 'x',
      stats: [{ ...realSubjectRate.stats[0], brandNewFlag: true }],
    };
    expect(SubjectSuccessRateSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected stats.type value (widened to string, no drift-drop)', () => {
    const drift = {
      ...realSubjectRate,
      stats: [{ ...realSubjectRate.stats[0], type: 'new_kind' }],
    };
    expect(SubjectSuccessRateSchema.safeParse(drift).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(SubjectSuccessRateSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: stats is not an array', () => {
    expect(SubjectSuccessRateSchema.safeParse({ ...realSubjectRate, stats: 'nope' }).success).toBe(
      false
    );
  });

  it('rejects genuine corruption: missing courseCode', () => {
    const { courseCode: _courseCode, ...noCode } = realSubjectRate;
    expect(SubjectSuccessRateSchema.safeParse(noCode).success).toBe(false);
  });
});

describe('SuccessRateDataSchema', () => {
  it('accepts a representative real aggregate payload (never drops valid data)', () => {
    expect(SuccessRateDataSchema.safeParse(realAggregate).success).toBe(true);
  });

  it('rejects genuine corruption: data is not an object', () => {
    expect(SuccessRateDataSchema.safeParse({ ...realAggregate, data: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: missing lastUpdated', () => {
    const { lastUpdated: _lastUpdated, ...noLastUpdated } = realAggregate;
    expect(SuccessRateDataSchema.safeParse(noLastUpdated).success).toBe(false);
  });
});

describe('SuccessRatesSchema (union used by the IDB store)', () => {
  it('accepts the aggregate shape (key "current")', () => {
    expect(SuccessRatesSchema.safeParse(realAggregate).success).toBe(true);
  });

  it('accepts the bare per-subject shape (course-code keys, MockManager)', () => {
    expect(SuccessRatesSchema.safeParse(realSubjectRate).success).toBe(true);
  });

  it('rejects genuine corruption: null', () => {
    expect(SuccessRatesSchema.safeParse(null).success).toBe(false);
  });
});
