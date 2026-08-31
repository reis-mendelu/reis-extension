import { describe, it, expect } from 'vitest';
import { toAuthEmail, SOCIETY_EMAIL_DOMAIN } from '../societyLogin';

describe('toAuthEmail', () => {
  it('maps a bare username to the synthetic domain', () => {
    expect(toAuthEmail('supef')).toBe('supef@societies.invalid');
  });

  it('normalises casing and surrounding whitespace', () => {
    expect(toAuthEmail('  SuPeF \n')).toBe('supef@societies.invalid');
  });

  it('passes a full address through unchanged (break-glass admin)', () => {
    expect(toAuthEmail('reis.mendelu@gmail.com')).toBe('reis.mendelu@gmail.com');
  });

  it('lowercases a passed-through address', () => {
    expect(toAuthEmail(' REIS.Mendelu@Gmail.com ')).toBe('reis.mendelu@gmail.com');
  });

  it('rejects a username with characters that cannot appear in an address', () => {
    expect(() => toAuthEmail('su pef')).toThrow(/invalid username/i);
    expect(() => toAuthEmail('supef!')).toThrow(/invalid username/i);
  });

  it('rejects an empty username', () => {
    expect(() => toAuthEmail('   ')).toThrow(/invalid username/i);
  });

  it('exports the domain it uses', () => {
    expect(SOCIETY_EMAIL_DOMAIN).toBe('societies.invalid');
  });
});
