import { describe, it, expect } from 'vitest';
import { handleToEmail } from '../societyLogin';

describe('handleToEmail', () => {
  it('maps a handle to the synthetic society email', () => {
    expect(handleToEmail('supef')).toBe('supef@societies.reis.invalid');
  });
  it('lowercases and trims', () => {
    expect(handleToEmail('  ESN ')).toBe('esn@societies.reis.invalid');
  });
});
