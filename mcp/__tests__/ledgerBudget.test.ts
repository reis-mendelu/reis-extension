// The overview has to fit one answer however full the ledger is: the cap of entries, every
// string at its longest, folders as big as the budget test's. The upcoming list gives way last
// to the file lists and the assignments, and says how many it left out.
import { describe, it, expect } from 'vitest';
import { CHARACTER_LIMIT, toResult } from '../format';
import { fitOverview } from '../overviewRender';
import type { Gathered } from '../overviewGather';
import type { SubjectFile } from '../files';
import { MAX_ENTRIES, finish, type LedgerEntry } from '../ledgerEntry';
import { parseFields } from '../ledgerFields';

const codes = Array.from({ length: 7 }, (_, i) => `EBC-S${i}`);
const file = (code: string, n: number): SubjectFile => ({
  name: `Přednáška ${n} – úvod do problematiky ${code}`,
  file: `prednaska_${n}_${code}_final_verze.pdf`,
  author: 'Novák',
  date: '1. 10. 2026',
  modified: '2. 10. 2026',
  downloadUrl: `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${1000000 + n};id=${codes.indexOf(code)};z=1`,
});
const gathered = (perSubject: number, boxes = 0): Gathered => ({
  subjects: codes.map((code) => ({ code, name: `Předmět ${code}`, subjectId: '1' })),
  listings: Object.fromEntries(
    codes.map((c) => [c, Array.from({ length: perSubject }, (_, n) => file(c, n))])
  ),
  world: { subjects: [], files: {}, points: {} },
  boxes: Array.from({ length: boxes }, (_, i) => ({
    key: String(i),
    code: 'EBC-S0',
    name: `Odevzdání ${'dlouhý název '.repeat(8)}${i}`,
    deadline: `${(i % 27) + 1}.12.2026 23:59`,
    open: true,
    submission: 'nothing_uploaded',
    points: '',
  })),
  problems: [],
});

const longest = (i: number): LedgerEntry =>
  finish(
    parseFields({
      title: 'T'.repeat(120),
      kind: 'test',
      code: 'EBC-S0',
      date: `2026-12-${String((i % 28) + 2).padStart(2, '0')}`,
      time: '09:00',
      room: 'R'.repeat(60),
      points: '9'.repeat(40),
      rule: 'r'.repeat(500),
      depends_on: 'd'.repeat(300),
      unregister_by: '2026-12-01 12:00',
      source_kind: 'course_file',
      source_file: 'f'.repeat(200),
      source_url: `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${i}${'x'.repeat(500)}`,
      source_modified: '1. 10. 2026',
      basis: 'inferred',
      inferred_how: 'h'.repeat(300),
    }) as never,
    { id: `ev-${String(i).padStart(12, '0')}`, savedAt: '', updatedAt: '' }
  );

const NOW = new Date('2026-12-01T11:00:00Z');
const run = (g: Gathered, n: number, format: 'markdown' | 'json') =>
  fitOverview({
    g,
    first: true,
    changes: [],
    profile: null,
    saved: () => false,
    ledger: Array.from({ length: n }, (_, i) => longest(i)),
    format,
    now: NOW,
  });

describe('a full ledger still fits one answer', () => {
  for (const format of ['markdown', 'json'] as const) {
    for (const [label, perSubject, boxes] of [
      ['small folders', 3, 0],
      ['big folders', 43, 0],
      ['big folders and many assignments', 43, 60],
    ] as const) {
      it(`${MAX_ENTRIES} entries at their longest, ${label} (${format}), no cut marker`, () => {
        const { out } = run(gathered(perSubject, boxes), MAX_ENTRIES, format);
        const text = toResult(out, format).content[0]!.text;
        expect(text.length).toBeLessThanOrEqual(CHARACTER_LIMIT);
        expect(text).not.toContain('[truncated');
      });
    }
  }

  it('lists the soonest events first and says how many more there are', () => {
    const { out } = run(gathered(3), 60, 'json');
    const o = out as { upcoming: { daysLeft: number; source: string }[]; moreUpcoming?: string };
    expect(o.upcoming.length).toBeLessThanOrEqual(20);
    expect(o.upcoming.map((u) => u.daysLeft)).toEqual(
      [...o.upcoming.map((u) => u.daysLeft)].sort((a, b) => a - b)
    );
    expect(o.moreUpcoming).toMatch(/\d+ more.*mendelu_ledger/);
  });

  it('keeps the upcoming list when only the file lists and assignments have to give way', () => {
    const { out } = run(gathered(43, 60), 20, 'json');
    const o = out as { upcoming?: unknown[] };
    expect(o.upcoming?.length).toBe(20);
  });
});
