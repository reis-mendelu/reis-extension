import { describe, it, expect } from 'vitest';
import { generatePassword, toAuthEmail } from '../password';

describe('generatePassword', () => {
  it('is 20 characters', () => {
    expect(generatePassword()).toHaveLength(20);
  });

  it('avoids visually ambiguous characters', () => {
    const joined = Array.from({ length: 50 }, generatePassword).join('');
    expect(joined).not.toMatch(/[O0Il1]/);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, generatePassword));
    expect(seen.size).toBe(200);
  });
});

describe('toAuthEmail (function copy)', () => {
  it('matches the client mapping', () => {
    expect(toAuthEmail('supef')).toBe('supef@societies.invalid');
  });

  it('rejects a malformed username', () => {
    expect(() => toAuthEmail('su pef')).toThrow(/invalid username/i);
  });
});
