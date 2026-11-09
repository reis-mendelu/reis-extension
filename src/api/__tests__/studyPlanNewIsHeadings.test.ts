import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStudyPlanDOM } from '../studyPlan';

/**
 * The next IS release, previewed on test.is.mendelu.cz on 2026-11-09, prints
 * the semester and whole-plan headings of Kontrola plánu as
 *
 *   <span style="font-size: 1.125rem; font-weight: bold;">1. semestr ZS 2025/2026 - PEF</span>
 *
 * where production prints `<b><font size="+1">…</font></b>`. Everything else on
 * the page — the plan title, the "Skupina předmětů…" group rows, the subject
 * rows — kept its `<b>`. Measured on one account: 8 `<font size="+1">` on prod,
 * 0 on test, and the same 8 headings as bold spans on test. With the old parser
 * the 8 semester blocks collapsed into 1, which also emptied every past
 * subject's `subjectId` (taken from the plan) and so its syllabus.
 *
 * Nobody knows the day IS switches, so both markups must parse, and the same:
 * each fixture below is real prod HTML, rewritten the one way test IS differs.
 */
const NEW_HEADING = '<span style="font-size: 1.125rem; font-weight: bold;">$1</span>';
const toNewIs = (html: string) =>
  html.replace(/<b\s*><font size="\+1">([\s\S]*?)<\/font><\/b>/g, NEW_HEADING);

const read = (name: string) =>
  readFileSync(resolve(process.cwd(), `src/api/__tests__/fixtures/${name}`), 'utf8');
const parse = (html: string, lang: 'cz' | 'en') =>
  parseStudyPlanDOM(new DOMParser().parseFromString(html, 'text/html'), lang);

const FIXTURES = [
  ['study-plan-by-periods.two-plans.cz.html', 'cz'],
  ['study-plan-by-periods.two-plans.en.html', 'en'],
  ['study-plan-by-plans.two-plans.cz.html', 'cz'],
  ['study-plan-by-plans.two-plans.en.html', 'en'],
  ['study-plan-by-plans.three-plans.cz.html', 'cz'],
] as const;

describe('study plan headings in the new IS markup', () => {
  for (const [name, lang] of FIXTURES) {
    it(`parses ${name} the same before and after the switch`, () => {
      const oldHtml = read(name);
      const newHtml = toNewIs(oldHtml);
      // the rewrite must have hit something, or this test proves nothing
      expect(newHtml).not.toBe(oldHtml);
      expect(newHtml).not.toContain('<font size="+1">');

      const before = parse(oldHtml, lang);
      expect(before.blocks.length).toBeGreaterThan(1);
      expect(parse(newHtml, lang)).toEqual(before);
    });
  }
});
