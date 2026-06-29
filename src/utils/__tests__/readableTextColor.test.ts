import { describe, it, expect } from 'vitest';
import { readableTextColor } from '../readableTextColor';

describe('readableTextColor', () => {
  it('picks dark text on light/saturated colours (ESN cyan)', () => {
    // white on #00AEEF is only ~2.5:1 — the bug this fixes
    expect(readableTextColor('#00AEEF')).toBe('#111827');
  });

  it('picks white text on dark colours (SU PEF blue, AU FRRMS magenta)', () => {
    expect(readableTextColor('#0046a0')).toBe('#ffffff');
    expect(readableTextColor('#c32897')).toBe('#ffffff');
  });

  it('handles the extremes', () => {
    expect(readableTextColor('#000000')).toBe('#ffffff');
    expect(readableTextColor('#ffffff')).toBe('#111827');
  });
});
