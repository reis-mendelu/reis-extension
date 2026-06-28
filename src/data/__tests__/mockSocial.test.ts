import { describe, it, expect } from 'vitest';
import { socialFor } from '../mockSocial';

describe('socialFor', () => {
  it('is deterministic for the same id', () => {
    expect(socialFor('evt-42')).toEqual(socialFor('evt-42'));
  });

  it('produces different results for different ids', () => {
    const a = socialFor('evt-1');
    const b = socialFor('evt-2');
    expect(a).not.toEqual(b);
  });

  it('returns plausible going / interested counts', () => {
    const s = socialFor('evt-7');
    expect(s.going).toBeGreaterThanOrEqual(8);
    expect(s.going).toBeLessThanOrEqual(187);
    expect(s.interested).toBeGreaterThanOrEqual(3);
    expect(s.interested).toBeLessThanOrEqual(42);
  });

  it('carries no per-person identity (no names or initials)', () => {
    const s = socialFor('evt-99');
    expect(s).not.toHaveProperty('attendees');
  });
});
