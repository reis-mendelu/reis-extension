import { describe, it, expect } from 'vitest';
import { relativeTime } from '../relativeTime';

const MIN = 60_000;

describe('relativeTime', () => {
  it('says nothing under a minute — the caller shows "just now" instead', () => {
    expect(relativeTime(30_000, 'cs')).toBe('');
  });

  it('counts minutes, hours and days in the given locale', () => {
    expect(relativeTime(5 * MIN, 'cs')).toBe('před 5 minutami');
    expect(relativeTime(3 * 60 * MIN, 'cs')).toBe('před 3 hodinami');
    expect(relativeTime(2 * 24 * 60 * MIN, 'en')).toBe('2 days ago');
  });
});
