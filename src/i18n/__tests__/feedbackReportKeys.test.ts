import { describe, it, expect } from 'vitest';
import cs from '../locales/cs.json';
import en from '../locales/en.json';

const KEYS = ['reportLink', 'reportAction'];
const PREFILLS = ['examsEmpty', 'subjectsEmpty', 'syllabusEmpty', 'zaznamnikEmpty', 'examActionFailed'];

describe('report entry-point strings', () => {
  for (const [name, locale] of [['cs', cs], ['en', en]] as const) {
    const fb = (locale as unknown as Record<string, Record<string, unknown>>).feedback;
    it(`${name} has every link/action key`, () => {
      for (const k of KEYS) expect(fb[k], k).toEqual(expect.any(String));
    });
    // The exact title is the measurement bucket (reports are grouped by it),
    // so every entry point's title must exist and differ from the others.
    it(`${name} has a distinct prefill title per entry point`, () => {
      const prefill = (fb.prefill ?? {}) as Record<string, string>;
      const titles = PREFILLS.map((k) => prefill[k]);
      for (const t of titles) expect(t).toMatch(/^[^:]+: \S/);
      expect(new Set(titles).size).toBe(PREFILLS.length);
    });
  }
});
