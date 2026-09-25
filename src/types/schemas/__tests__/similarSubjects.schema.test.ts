import { describe, it, expect } from 'vitest';
import { SimilarFileSchema } from '../similarSubjects.schema';

const ok = {
  courseCode: 'EKOE1',
  generatedAt: '2026-09-24T12:00:00Z',
  suggestions: [
    {
      code: 'EKO1R',
      nameCs: 'Ekologie I (RSZ)',
      nameEn: 'Ecology I',
      reasons: ['sameName', 'sameGuarantor'],
      completion: 'credit',
      completionChanged: true,
      lastYear: 2025,
    },
  ],
};

describe('SimilarFileSchema', () => {
  it('accepts the file build-similar.ts writes', () => {
    expect(SimilarFileSchema.safeParse(ok).success).toBe(true);
  });

  it('keeps a reason it does not know, so a newer file still parses', () => {
    const next = { ...ok, suggestions: [{ ...ok.suggestions[0], reasons: ['sameSomethingNew'] }] };
    expect(SimilarFileSchema.safeParse(next).success).toBe(true);
  });

  it('accepts an unknown completion as null and no year as null', () => {
    const s = { ...ok.suggestions[0], completion: null, lastYear: null };
    expect(SimilarFileSchema.safeParse({ ...ok, suggestions: [s] }).success).toBe(true);
  });

  it('rejects a suggestion without its flags', () => {
    const { completionChanged: _drop, ...broken } = ok.suggestions[0]!;
    expect(SimilarFileSchema.safeParse({ ...ok, suggestions: [broken] }).success).toBe(false);
  });
});
