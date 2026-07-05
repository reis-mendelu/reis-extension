import { describe, it, expect } from 'vitest';
import { MetaSchema } from '../meta.schema';

describe('MetaSchema (generic heterogeneous KV bucket)', () => {
  it('accepts a boolean flag (e.g. dev_features_enabled)', () => {
    expect(MetaSchema.safeParse(true).success).toBe(true);
  });

  it('accepts a string (e.g. an ISO timestamp or token)', () => {
    expect(MetaSchema.safeParse('2026-07-06T10:00:00.000Z').success).toBe(true);
  });

  it('accepts a number', () => {
    expect(MetaSchema.safeParse(42).success).toBe(true);
  });

  it('accepts null', () => {
    expect(MetaSchema.safeParse(null).success).toBe(true);
  });

  it('accepts an array of primitives (e.g. recent_searches, read_notifications)', () => {
    expect(MetaSchema.safeParse(['EBC-ALG', 'EBC-MAT']).success).toBe(true);
  });

  it('accepts a nested plain object (e.g. course_deadlines, notifications_cache)', () => {
    const nested = {
      'EBC-ALG': { deadline: '2026-08-01', reminders: [1, 2, 3] },
      meta: { fetchedAt: '2026-07-06T10:00:00.000Z', flags: { synced: true } },
    };
    expect(MetaSchema.safeParse(nested).success).toBe(true);
  });

  it('rejects genuine corruption: undefined', () => {
    expect(MetaSchema.safeParse(undefined).success).toBe(false);
  });

  it('rejects genuine corruption: a function value nested in an object', () => {
    expect(MetaSchema.safeParse({ callback: () => {} }).success).toBe(false);
  });

  it('rejects genuine corruption: a symbol', () => {
    expect(MetaSchema.safeParse(Symbol('x')).success).toBe(false);
  });
});
