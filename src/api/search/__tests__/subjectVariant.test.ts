import { describe, it, expect } from 'vitest';
import { isEnglishVariantCode, semesterRank } from '../subjectVariant';

describe('isEnglishVariantCode', () => {
  it('detects the English-taught (v AJ) PEF variants by code', () => {
    expect(isEnglishVariantCode('EBA-ST')).toBe(true);   // Statistika v AJ
    expect(isEnglishVariantCode('ENA-MA')).toBe(true);   // Makroekonomie 2 v AJ
    expect(isEnglishVariantCode('EXA-CEUSR')).toBe(true);
    expect(isEnglishVariantCode('eba-akp')).toBe(true);  // case-insensitive
  });

  it('treats Czech-taught and non-PEF codes as not-English', () => {
    expect(isEnglishVariantCode('EBC-ST')).toBe(false);  // Statistika (Czech)
    expect(isEnglishVariantCode('ENC-MA')).toBe(false);
    expect(isEnglishVariantCode('MZD')).toBe(false);
    expect(isEnglishVariantCode('AGRL')).toBe(false);
    expect(isEnglishVariantCode('')).toBe(false);
  });
});

describe('semesterRank', () => {
  it('orders newer academic years above older ones', () => {
    expect(semesterRank('LS 2025/2026')).toBeGreaterThan(semesterRank('LS 2024/2025'));
    expect(semesterRank('ZS 2025/2026')).toBeGreaterThan(semesterRank('LS 2024/2025'));
  });

  it('orders summer (LS/SS) after winter (ZS/WS) within the same academic year', () => {
    expect(semesterRank('LS 2025/2026')).toBeGreaterThan(semesterRank('ZS 2025/2026'));
    expect(semesterRank('SS 2025/2026')).toBeGreaterThan(semesterRank('WS 2025/2026'));
  });

  it('treats EN labels (WS/SS) the same as CZ labels (ZS/LS)', () => {
    expect(semesterRank('WS 2025/2026')).toBe(semesterRank('ZS 2025/2026'));
    expect(semesterRank('SS 2025/2026')).toBe(semesterRank('LS 2025/2026'));
  });

  it('ranks an empty / unparseable semester lowest', () => {
    expect(semesterRank('')).toBeLessThan(semesterRank('ZS 2000/2001'));
    expect(semesterRank('garbage')).toBeLessThan(semesterRank('ZS 2000/2001'));
  });
});
