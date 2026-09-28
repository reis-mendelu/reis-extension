import { describe, it, expect } from 'vitest';
import { normalizeInstagram } from '../societyFormRules';

describe('normalizeInstagram', () => {
  it('strips @ and whitespace', () =>
    expect(normalizeInstagram('  @esnmendelubrno ')).toBe('esnmendelubrno'));
  it('empty means none', () => expect(normalizeInstagram('  ')).toBeNull());
  it('accepts a profile URL and keeps only the handle', () =>
    expect(normalizeInstagram('https://www.instagram.com/led_zf/')).toBe('led_zf'));
  it('rejects anything the database would', () => {
    expect(normalizeInstagram('a/b')).toBe('invalid');
    expect(normalizeInstagram('x'.repeat(31))).toBe('invalid');
  });
});
