import { describe, it, expect } from 'vitest';
import { resolvePredmetId } from '../resolvePredmetId';
import type { SubjectSuccessRate } from '@/types/documents';

const rate = (predmetId?: string): SubjectSuccessRate => ({ courseCode: 'EBC-ZUI', stats: [], lastUpdated: '', predmetId });

describe('resolvePredmetId', () => {
  it('returns a valid 5-6 digit IS predmet id', () => {
    expect(resolvePredmetId(rate('160301'))).toBe('160301');
    expect(resolvePredmetId(rate('99410'))).toBe('99410');
  });

  it('rejects junk short ids seen in reis-data (3 / 4 / 7)', () => {
    expect(resolvePredmetId(rate('3'))).toBeUndefined();
    expect(resolvePredmetId(rate('7'))).toBeUndefined();
    expect(resolvePredmetId(rate('1234'))).toBeUndefined();
  });

  it('rejects non-numeric or empty ids', () => {
    expect(resolvePredmetId(rate('abc123'))).toBeUndefined();
    expect(resolvePredmetId(rate(''))).toBeUndefined();
    expect(resolvePredmetId(rate(undefined))).toBeUndefined();
  });

  it('returns undefined when there is no success-rate record at all', () => {
    expect(resolvePredmetId(undefined)).toBeUndefined();
  });
});
