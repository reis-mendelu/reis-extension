import { describe, it, expect } from 'vitest';
import {
  snapshotAgeMs,
  isStale,
  maxAgeMsFromEnv,
  DAY_MS,
  DEFAULT_MAX_AGE_DAYS,
} from '../snapshotFreshness';

describe('snapshotAgeMs', () => {
  const now = 1_000 * DAY_MS; // arbitrary fixed "now"

  it('prefers lastSync over file mtime', () => {
    const age = snapshotAgeMs(now - 2 * DAY_MS, now - 5 * DAY_MS, now);
    expect(age).toBe(2 * DAY_MS);
  });

  it('falls back to file mtime when lastSync is missing/invalid', () => {
    expect(snapshotAgeMs(undefined, now - 3 * DAY_MS, now)).toBe(3 * DAY_MS);
    expect(snapshotAgeMs(0, now - 3 * DAY_MS, now)).toBe(3 * DAY_MS);
  });

  it('returns null when neither timestamp is available', () => {
    expect(snapshotAgeMs(undefined, undefined, now)).toBeNull();
  });

  it('never returns a negative age', () => {
    expect(snapshotAgeMs(now + 5 * DAY_MS, undefined, now)).toBe(0);
  });
});

describe('isStale', () => {
  it('is stale when age is unknown (null)', () => {
    expect(isStale(null, 7 * DAY_MS)).toBe(true);
  });
  it('is stale at or beyond the max age', () => {
    expect(isStale(7 * DAY_MS, 7 * DAY_MS)).toBe(true);
    expect(isStale(8 * DAY_MS, 7 * DAY_MS)).toBe(true);
  });
  it('is fresh below the max age', () => {
    expect(isStale(6 * DAY_MS, 7 * DAY_MS)).toBe(false);
  });
});

describe('maxAgeMsFromEnv', () => {
  it('defaults to DEFAULT_MAX_AGE_DAYS when unset', () => {
    expect(maxAgeMsFromEnv({})).toBe(DEFAULT_MAX_AGE_DAYS * DAY_MS);
  });
  it('reads REIS_SNAPSHOT_MAX_AGE_DAYS', () => {
    expect(maxAgeMsFromEnv({ REIS_SNAPSHOT_MAX_AGE_DAYS: '3' })).toBe(3 * DAY_MS);
  });
  it('supports 0 (always stale) for testing', () => {
    expect(maxAgeMsFromEnv({ REIS_SNAPSHOT_MAX_AGE_DAYS: '0' })).toBe(0);
  });
  it('ignores non-numeric values and uses the default', () => {
    expect(maxAgeMsFromEnv({ REIS_SNAPSHOT_MAX_AGE_DAYS: 'nope' })).toBe(
      DEFAULT_MAX_AGE_DAYS * DAY_MS
    );
  });
});
