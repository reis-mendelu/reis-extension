import { describe, it, expect } from 'vitest';
import { CvicneTestsSchema } from '../cvicneTests.schema';
import type { CvicnyTest } from '../../../api/cvicneTests';

// A representative real cvicny test entry (mirrors what fetchCvicneTests writes).
const realData: CvicnyTest[] = [
  {
    courseId: '159410',
    courseNameCs: 'Algoritmizace',
    courseNameEn: 'Algorithmization',
    name: 'Test 1',
    url: 'https://is.mendelu.cz/auth/elis/student/test.pl?id=1',
    status: 'accessible',
  },
];

describe('CvicneTestsSchema', () => {
  it('accepts a representative real cvicny test list (never drops valid data)', () => {
    expect(CvicneTestsSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts an empty list', () => {
    expect(CvicneTestsSchema.safeParse([]).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    const withExtra = [{ ...realData[0], futureField: 'x' }];
    expect(CvicneTestsSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected status value (widened to string, no drift-drop)', () => {
    const drift = [{ ...realData[0], status: 'new_status' }];
    expect(CvicneTestsSchema.safeParse(drift).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(CvicneTestsSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: not an array', () => {
    expect(CvicneTestsSchema.safeParse(realData[0]).success).toBe(false);
  });

  it('rejects genuine corruption: entry missing courseId', () => {
    const { courseId: _courseId, ...noCourseId } = realData[0];
    expect(CvicneTestsSchema.safeParse([noCourseId]).success).toBe(false);
  });
});
