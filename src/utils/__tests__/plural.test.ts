import { describe, it, expect } from 'vitest';
import { pluralSuffix } from '../plural';

describe('pluralSuffix', () => {
  // Czech has three cardinal forms, which is why a single invariant string
  // ("2 kreditů") reads as broken grammar to a native speaker.
  describe('czech', () => {
    it('uses the singular for 1', () => {
      expect(pluralSuffix('cs', 1)).toBe('One');
    });

    it('uses the 2-4 form', () => {
      expect(pluralSuffix('cs', 2)).toBe('Few');
      expect(pluralSuffix('cs', 3)).toBe('Few');
      expect(pluralSuffix('cs', 4)).toBe('Few');
    });

    it('uses the genitive plural from 5 up, and for 0', () => {
      expect(pluralSuffix('cs', 5)).toBe('Other');
      expect(pluralSuffix('cs', 11)).toBe('Other');
      expect(pluralSuffix('cs', 0)).toBe('Other');
    });

    it('treats the IS language code "cz" as czech', () => {
      expect(pluralSuffix('cz', 2)).toBe('Few');
    });
  });

  describe('english', () => {
    it('splits only on 1 vs everything else', () => {
      expect(pluralSuffix('en', 1)).toBe('One');
      expect(pluralSuffix('en', 2)).toBe('Other');
      expect(pluralSuffix('en', 5)).toBe('Other');
      expect(pluralSuffix('en', 0)).toBe('Other');
    });
  });

  it('falls back to czech for an unknown language, matching useTranslation', () => {
    expect(pluralSuffix('xx', 3)).toBe('Few');
  });
});
