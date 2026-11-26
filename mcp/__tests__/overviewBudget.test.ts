// The answer has to fit one tool result (format.ts CHARACTER_LIMIT): when a student's
// folders are too big, file lists give way to a pointer, and the changes never do.
import { describe, it, expect } from 'vitest';
import { CHARACTER_LIMIT, toResult } from '../format';
import { fitOverview, renderOverview } from '../overviewRender';
import type { Gathered } from '../overviewGather';
import type { Change } from '../overviewDiff';
import type { SubjectFile } from '../files';

const subjects = Array.from({ length: 7 }, (_, i) => `EBC-S${i}`);
const file = (code: string, n: number): SubjectFile => ({
  name: `Přednáška ${n} – úvod do problematiky ${code}`,
  file: `prednaska_${n}_${code}_final_verze.pdf`,
  author: 'Novák',
  date: '1. 10. 2026',
  modified: '2. 10. 2026',
  downloadUrl: `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${1000000 + n};id=${123456 + subjects.indexOf(code)};z=1`,
});

const gathered = (perSubject: number): Gathered => {
  const listings = Object.fromEntries(
    subjects.map((c) => [c, Array.from({ length: perSubject }, (_, n) => file(c, n))])
  );
  return {
    subjects: subjects.map((code) => ({ code, name: `Předmět ${code}`, subjectId: '1' })),
    listings,
    world: {
      subjects: [],
      files: {},
      points: Object.fromEntries(subjects.map((c) => [c, [{ key: 'PH / T1', text: 'Body=5' }]])),
    },
    problems: [],
  };
};
const run = (
  perSubject: number,
  changes: Change[] = [],
  format: 'markdown' | 'json' = 'markdown'
) =>
  renderOverview({
    g: gathered(perSubject),
    first: !changes.length,
    changes,
    profile: null,
    saved: () => false,
    format,
  });

describe('renderOverview', () => {
  for (const format of ['markdown', 'json'] as const) {
    it(`fits one answer for 7 subjects and 300 files (${format}), with no cut marker`, () => {
      const out = run(43, [], format);
      const r = toResult(out, format);
      expect(r.content[0]!.text.length).toBeLessThanOrEqual(CHARACTER_LIMIT);
      expect(r.content[0]!.text).not.toContain('[truncated');
    });
  }

  it('lists every file when they fit, and says when a list was replaced by a pointer', () => {
    const small = JSON.stringify(run(5));
    expect(small).not.toContain('files in all');
    expect(JSON.stringify(run(43))).toContain('43 files in all');
    expect(JSON.stringify(run(43))).toContain('call mendelu_subject_files with code EBC-S6');
  });

  it('still marks a new file inside a list that was cut, and never cuts the changes', () => {
    const f = file('EBC-S3', 7);
    const changes: Change[] = [
      {
        kind: 'file',
        what: 'new',
        code: 'EBC-S3',
        url: f.downloadUrl,
        text: 'New file in EBC-S3: x',
      },
      ...Array.from({ length: 30 }, (_, i): Change => ({
        kind: 'box',
        code: 'EBC-S1',
        text: `New assignment box in EBC-S1: Box ${i}`,
      })),
    ];
    const text = toResult(run(43, changes), 'markdown').content[0]!.text;
    expect(text).toContain(f.downloadUrl);
    for (let i = 0; i < 30; i++) expect(text).toContain(`Box ${i}`);
    expect(text).not.toContain('[truncated');
  });
});

describe('many open assignments with long names', () => {
  const boxes = Array.from({ length: 300 }, (_, i) => ({
    key: `EBC-S1|${i}`,
    code: 'EBC-S1',
    name: `Domácí úkol číslo ${i}: ${'velmi dlouhé zadání s podrobným popisem '.repeat(4)}`,
    deadline: `${(i % 28) + 1}.12.2099 23:59`,
    open: true,
    submission: 'nothing_uploaded',
    points: '',
  }));
  for (const format of ['markdown', 'json'] as const) {
    it(`are bounded with a pointer, so the answer fits and stays valid (${format})`, () => {
      const g = { ...gathered(5), boxes };
      const out = renderOverview({
        g,
        first: true,
        changes: [],
        profile: null,
        saved: () => false,
        format,
      });
      const text = toResult(out, format).content[0]!.text;
      expect(text.length).toBeLessThanOrEqual(CHARACTER_LIMIT);
      expect(text).not.toContain('[truncated');
      expect(text).toContain('mendelu_assignments');
      if (format === 'json') expect(() => JSON.parse(text)).not.toThrow();
    });
  }

  it('keeps every changed file row it can: the files are held back, not the assignments first', () => {
    const f = file('EBC-S3', 7);
    const change: Change = {
      kind: 'file',
      what: 'new',
      code: 'EBC-S3',
      url: f.downloadUrl,
      text: 'x',
    };
    const { held } = fitOverview({
      g: { ...gathered(5), boxes },
      first: false,
      changes: [change],
      profile: null,
      saved: () => false,
      format: 'json',
    });
    expect(held).toEqual([]);
  });
});

describe('a bulk upload with a few open assignments', () => {
  it('keeps the assignments that fit, and holds back files only', () => {
    const g = {
      ...gathered(60),
      boxes: [1, 2, 3].map((i) => ({
        key: `EBC-S1|${i}`,
        code: 'EBC-S1',
        name: `Úkol ${i}`,
        deadline: `${i}.12.2099 23:59`,
        open: true,
        submission: 'nothing_uploaded',
        points: '',
      })),
    };
    const changes = Object.entries(g.listings).flatMap(([code, files]) =>
      files!.map((f): Change => ({
        kind: 'file',
        what: 'new',
        code,
        url: f.downloadUrl,
        text: 'x',
      }))
    );
    const { out, held } = fitOverview({
      g,
      first: false,
      changes,
      profile: null,
      saved: () => false,
      format: 'json',
    });
    const o = JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
    expect(held.length).toBeGreaterThan(0);
    expect(o.openAssignments).toHaveLength(3);
    expect(o.moreAssignments).toBeUndefined();
  });
});
