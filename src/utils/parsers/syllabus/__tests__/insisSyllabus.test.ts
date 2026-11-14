import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSyllabusOffline } from '../../syllabusParser';

/**
 * VŠE's InSIS runs the same UIS as IS Mendelu, but its syllabus template labels
 * the rows differently (fixtures trimmed and anonymised from a real
 * insis.vse.cz syllabus.pl page, 2026-11-08). MENDELU's labels are always tried
 * first; a VŠE label is read only when no MENDELU label matched, so MENDELU
 * results stay pinned by the other syllabus tests.
 *
 * - credits: "Počet přidělených ECTS kreditů" / "Number of ECTS credits allocated"
 * - completion: "Forma ukončení" / "Mode of completion"
 * - objectives: "Zaměření předmětu" (EN "Aims of the course" already matched)
 * - requirements text: "Zvláštní podmínky a podrobnosti" / "Special requirements
 *   and details" — the pass conditions in prose
 * - requirements table: the weights under "Způsoby a kritéria hodnocení" /
 *   "Assessment methods and criteria" ("Hodnocení" is the grade scale, not read)
 */
const read = (name: string) =>
  readFileSync(resolve(process.cwd(), `src/api/__tests__/fixtures/${name}`), 'utf8');

const CASES = [
  {
    lang: 'cz',
    completion: 'zkouška',
    objectives: 'Předmět ukazuje a umožňuje zvládnout principy tvorby ekonometrických modelů',
    requirements: 'Odevzdání domácích úkolů je nutnou, nikoli však postačující, podmínkou',
    table: [
      ['Druh', 'Prezenční studium'],
      ['Absolvování závěrečného testu', '60 %'],
      ['Vypracování domácích úkolů', '40 %'],
      ['Celkem', '100 %'],
    ],
    content: 'Heteroskedasticita a robustní odhad chyb',
    firstTeacher: { name: 'Ing. Petr Ukázka', id: '271828', roles: 'cvičící' },
  },
  {
    lang: 'en',
    completion: 'graded course',
    objectives: 'The course is designed to show and master the principles of the econometric',
    requirements: 'Submission of homework is a prerequisite for successful completion',
    table: [
      ['Requirement type', 'Daily attendance'],
      ['Final test', '60 %'],
      ['Homework assignments', '40 %'],
      ['Total', '100 %'],
    ],
    content: 'Repeating basic concepts',
    firstTeacher: { name: 'Ing. Petr Ukázka', id: '271828', roles: 'instructor' },
  },
] as const;

describe('InSIS (VŠE) syllabus template', () => {
  for (const c of CASES) {
    describe(`syllabus.vse.${c.lang}.html`, () => {
      const result = parseSyllabusOffline(read(`syllabus.vse.${c.lang}.html`), c.lang);
      const info = result.courseInfo;

      it('reads ECTS credits and the completion type', () => {
        expect(info?.credits).toBe('6');
        expect(info?.completion).toBe(c.completion);
      });

      it('reads the objectives', () => {
        expect(result.objectivesText).toContain(c.objectives);
      });

      it('reads the requirements text and the weights table', () => {
        expect(result.requirementsText).toContain(c.requirements);
        expect(result.requirementsTable).toEqual(c.table);
      });

      it('reads the content and the teachers', () => {
        expect(result.contentText).toContain(c.content);
        expect(info?.teachers).toHaveLength(4);
        expect(info?.teachers[0]).toEqual(c.firstTeacher);
        // The VŠE syllabus names no garant.
        expect(info?.garant).toBeNull();
      });
    });
  }
});
