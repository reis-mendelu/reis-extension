import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isThisSemester } from '../EnrolledNowSection';

describe('isThisSemester', () => {
  beforeEach(() => {
    // Pin "now" inside the winter semester (Sep 1 – Jan 31) for deterministic ranges.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // 15 Jan 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts Czech dot-separated dates (DD.MM.YYYY)', () => {
    expect(isThisSemester('04.06.2025')).toBe(false); // outside winter semester range
    expect(isThisSemester('15.11.2025')).toBe(true); // inside winter semester
  });

  it('accepts English slash-separated dates in MM/DD/YYYY (US) order', () => {
    // Verified against a real IS Mendelu record for the same subject: the
    // Czech page shows "14.01.2026", the English page shows "01/14/2026" —
    // day 14 can't be a month, confirming month-first order in English.
    expect(isThisSemester('06/04/2025')).toBe(false); // 4 Jun 2025, outside winter semester
    expect(isThisSemester('11/15/2025')).toBe(true); // 15 Nov 2025, inside winter semester
  });

  it('returns false for missing or malformed dates', () => {
    expect(isThisSemester(undefined)).toBe(false);
    expect(isThisSemester('')).toBe(false);
    expect(isThisSemester('not-a-date')).toBe(false);
  });
});
