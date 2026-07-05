import { describe, it, expect } from 'vitest';
import { normalizeEmail } from '../societyLogin';

describe('normalizeEmail', () => {
  it('lowercases and trims the address', () => {
    expect(normalizeEmail('  Admin@SUPEF.cz ')).toBe('admin@supef.cz');
  });
  it('leaves an already-clean address unchanged', () => {
    expect(normalizeEmail('admin@esn.cz')).toBe('admin@esn.cz');
  });
});
