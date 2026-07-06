import { describe, it, expect } from 'vitest';
import { OdevzdavarnySchema } from '../odevzdavarny.schema';
import type { Odevzdavarna } from '../../../api/odevzdavarny';

// A representative real odevzdavarna entry (mirrors what fetchOdevzdavarny writes).
const realData: Odevzdavarna[] = [
  {
    courseId: '159410',
    courseNameCs: 'Algoritmizace',
    courseNameEn: 'Algorithmization',
    name: 'Semestrální práce',
    type: 'odevzdavarna-otevrena',
    deadline: '30.06.2026',
    odevzdavarnaId: '42',
    fileCount: 1,
    uploadUrl: 'https://is.mendelu.cz/auth/student/odevzdavarna.pl?odevzdavarna=42',
  },
];

describe('OdevzdavarnySchema', () => {
  it('accepts a representative real odevzdavarna list (never drops valid data)', () => {
    expect(OdevzdavarnySchema.safeParse(realData).success).toBe(true);
  });

  it('accepts an empty list', () => {
    expect(OdevzdavarnySchema.safeParse([]).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    const withExtra = [{ ...realData[0], futureField: 'x' }];
    expect(OdevzdavarnySchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected type value (widened to string, no drift-drop)', () => {
    const drift = [{ ...realData[0], type: 'new_type' }];
    expect(OdevzdavarnySchema.safeParse(drift).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(OdevzdavarnySchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: not an array', () => {
    expect(OdevzdavarnySchema.safeParse(realData[0]).success).toBe(false);
  });

  it('rejects genuine corruption: entry missing courseId', () => {
    const { courseId: _courseId, ...noCourseId } = realData[0]!; // safe: fixed 1-element literal
    expect(OdevzdavarnySchema.safeParse([noCourseId]).success).toBe(false);
  });
});
