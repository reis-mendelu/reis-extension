import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStudyPlanDOM } from '../studyPlan';

/**
 * VŠE's InSIS runs the same UIS as IS Mendelu, but its Kontrola plánu is laid
 * out by groups for the whole plan, and differs from MENDELU's in two ways
 * (fixtures trimmed and anonymised from a real insis.vse.cz page, 2026-11-08):
 *
 * 1. A group row carries the VŠE group label in a first `<b>` ("oSZ - Předměty
 *    státní závěrečné zkoušky (t: 1)") and the "Skupina předmětů…" heading in a
 *    second one. The parser read only the first, found no group at all, and put
 *    every subject of the plan into one "Ostatní předměty" group.
 * 2. Every subject is printed as a `predmety_vse_<group>` row ("all subjects of
 *    the group") and, if the student studies it or it is compulsory, again as a
 *    `predmety_<group>` row ("studied subjects only"). InSIS's own script hides
 *    `.predmety_vse` on load, so the studied view is what the student sees; the
 *    full page lists 2,022 catalogue rows next to 33 studied ones. Recognised
 *    credits ("Uznaný předmět") carry only `uis-hl-table` and are always shown.
 *
 * MENDELU's page has neither the second `<b>` nor the toggle; its results are
 * pinned by the other study-plan tests.
 */
const read = (name: string) =>
  readFileSync(resolve(process.cwd(), `src/api/__tests__/fixtures/${name}`), 'utf8');
const parse = (name: string, lang: 'cz' | 'en') =>
  parseStudyPlanDOM(new DOMParser().parseFromString(read(name), 'text/html'), lang);

const CASES = [
  {
    lang: 'cz' as const,
    block: 'Skupiny předmětů pro celý plán',
    groups: [
      [
        'oSZ - Předměty státní závěrečné zkoušky (t: 1)',
        'Skupina předmětů povinných',
        'NESPLNĚNA chybí 2 předměty',
      ],
      [
        'cVB - Celošk. volně volit. předmět (t: 3)',
        'Skupina předmětů povinně volitelných (min. 18 kr.)',
        'SPLNĚNA',
      ],
      [
        'oV - Volitelný předmět programu/oboru (t: 2)',
        'Skupina předmětů povinně volitelných (min. 17 kr.)',
        'SPLNĚNA',
      ],
      [
        'oP - Povinný předmět programu/oboru (t: 1)',
        'Skupina předmětů povinně volitelných (min. 28 př.)',
        'NESPLNĚNA chybí 9 předmětů',
      ],
      ['cTVS2 - Tělesná výchova - volitelné (t: 3)', 'Skupina předmětů volitelných', ''],
      ['cVOR - Předmět inženýrského studia (t: 3)', 'Skupina předmětů volitelných', ''],
      ['oJ1 - Jazykový předmět - první jazyk (t: 1)', 'Skupina předmětů volitelných', ''],
      ['oJ2 - Jazykový předmět - druhý jazyk (t: 1)', 'Skupina předmětů volitelných', ''],
    ],
    minimums: [{}, { minCredits: 18 }, { minCredits: 17 }, { minCount: 28 }, {}, {}, {}, {}],
  },
  {
    lang: 'en' as const,
    block: 'Groups of courses for the entire plan',
    groups: [
      [
        'oSZ - Final State Examination (t: 1)',
        'A group of required courses',
        'NOT ACCOMPLISHED missing 2 courses',
      ],
      [
        'cVB - General electives Bachelor (t: 3)',
        'A group of elective courses (min. 18 crd.)',
        'FULFILLED',
      ],
      ['oV - Electives bachelor (t: 2)', 'A group of elective courses (min. 17 crd.)', 'FULFILLED'],
      [
        'oP - Compulsory course bachelor (t: 1)',
        'A group of elective courses (min. 28 cours.)',
        'NOT ACCOMPLISHED missing 9 courses',
      ],
      ['cTVS2 - Physical Education - Elective (t: 3)', 'A group of optional courses', ''],
      ['cVOR - Master program course (t: 3)', 'A group of optional courses', ''],
      ['oJ1 - Language Subject (t: 1)', 'A group of optional courses', ''],
      ['oJ2 - Language Subject (t: 1)', 'A group of optional courses', ''],
    ],
    // "(min. 28 cours.)" yields no minCount in English, as on MENDELU's English page.
    minimums: [{}, { minCredits: 18 }, { minCredits: 17 }, {}, {}, {}, {}, {}],
  },
];

// Studied (and compulsory) subjects per group, in page order. Catalogue-only
// rows such as 5EN310 or TVSAER are in the fixture and must not come out.
const STUDIED = [
  ['5OBP', '5EKB'],
  ['2AJ323', '2AJ324', 'UP05'],
  ['5IE430', '5HP311', 'UP02'],
  ['5EN306', '1BP210', '5EN200'],
  [],
  [],
  [],
  [],
];

describe('InSIS (VŠE) study plan laid out by groups', () => {
  for (const { lang, block, groups, minimums } of CASES) {
    const plan = parse(`studijni-povinnosti.vse.${lang}.html`, lang);

    it(`${lang}: keeps the credit totals`, () => {
      expect(plan.creditsAcquired).toBe(145);
      expect(plan.creditsRequired).toBe(180);
      expect(plan.isFulfilled).toBe(false);
    });

    it(`${lang}: finds every group with its label, name and status`, () => {
      expect(plan.blocks.map((b) => [b.title, b.isWholePlanPool])).toEqual([[block, true]]);
      const got = plan.blocks[0]?.groups ?? [];
      expect(got.map((g) => [g.label, g.name, g.statusDescription])).toEqual(groups);
      expect(got.map((g) => ({ minCount: g.minCount, minCredits: g.minCredits }))).toEqual(
        minimums.map((m) => ({ minCount: undefined, minCredits: undefined, ...m }))
      );
    });

    it(`${lang}: lists the studied subjects of each group, not the whole catalogue`, () => {
      const got = plan.blocks[0]?.groups ?? [];
      const codes = got.map((g) => g.subjects.map((s) => s.code).sort());
      expect(codes).toEqual(STUDIED.map((c) => [...c].sort()));
      expect(got.map((g) => g.subjects.length)).toEqual([2, 3, 3, 3, 0, 0, 0, 0]);
    });
  }
});
