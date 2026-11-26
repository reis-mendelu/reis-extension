// mendelu_refresh stays inside one answer whatever the size of each list, and records as seen only
// what it reported: many inferred ledger events with no file change still give a whole, valid
// answer in both formats, and more than 40 changed points rows are all reported, each once, over
// several refreshes. Made-up names only.
import { it, describe, expect, vi } from 'vitest';

vi.mock('../../src/utils/userParams', () => ({
  getUserParams: vi.fn().mockResolvedValue({ studium: 'S', obdobi: 'O', studyForm: 'P' }),
}));
vi.mock('../../src/injector/dataFetchers', () => ({ fetchFullSemesterSchedule: vi.fn() }));
vi.mock('../../src/api/exams', () => ({ fetchDualLanguageExams: vi.fn() }));
vi.mock('../../src/api/subjects', () => ({ fetchDualLanguageSubjects: vi.fn() }));
vi.mock('../../src/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn() }));
vi.mock('../../src/api/successRate', () => ({ fetchSubjectSuccessRates: vi.fn() }));
vi.mock('../../src/api/gradeHistory', () => ({ fetchGradeHistory: vi.fn() }));
vi.mock('../../src/api/odevzdavarny', () => ({ fetchOdevzdavarny: vi.fn() }));
vi.mock('../../src/api/zaznamnik', () => ({ fetchSubjectZaznamnik: vi.fn() }));
vi.mock('../../src/api/documents/service', () => ({ fetchFolderListing: vi.fn() }));

import { boot } from './mapKit';
import { world, link } from './overviewKit';
import { R, folder, refresh } from './refreshKit';

const LIMIT = 25_000;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe('mendelu_refresh answer size', () => {
  it('many inferred events and no changed file: whole answer, valid JSON and markdown, the rest pointed to', async () => {
    const dir = await folder();
    const s = boot(dir);
    await refresh(s);
    for (let i = 0; i < 60; i++) {
      await s.call('mendelu_ledger', {
        action: 'add',
        title: `Průběžný test ${i} ${'z dlouhého harmonogramu předmětu '.repeat(3)}`.slice(0, 120),
        kind: 'test',
        code: 'EBC-PE',
        date: inDays(1 + (i % 12)),
        time: `${String(8 + (i % 10)).padStart(2, '0')}:00`,
        room: `Q${i} ${'budova Q, třetí patro'.repeat(2)}`.slice(0, 60),
        basis: 'inferred',
        inferred_how:
          `týden ${i} podle harmonogramu ${'a podle rozvrhu cvičení '.repeat(10)}`.slice(0, 300),
        source_kind: 'course_file',
        source_url: link(99), // not listed: every entry is to recheck
        source_file: 'harmonogram-stary.pdf',
        source_modified: '1. 10. 2026',
      });
    }
    const asJson = await boot(dir).call(R, { response_format: 'json' });
    const text = asJson.content[0]!.text!;
    expect(text.length).toBeLessThanOrEqual(LIMIT);
    const r = JSON.parse(text) as Record<string, unknown>;
    expect(r.changed).toBeUndefined();
    // The lists themselves gave way: fewer than the 30 a small answer shows.
    expect((r.upcoming as unknown[]).length).toBeLessThan(30);
    expect(String(r.moreUpcoming)).toMatch(/mendelu_ledger/);
    expect(String(r.moreRecheck)).toMatch(/mendelu_ledger/);
    const md = (await boot(dir).call(R)).content[0]!.text!;
    expect(md.length).toBeLessThanOrEqual(LIMIT);
    expect(md).not.toMatch(/\[truncated at/);
  }, 60_000);

  it('more than 40 changed points rows are all reported, each exactly once, across refreshes', async () => {
    const dir = await folder();
    const names = Array.from({ length: 55 }, (_, i) => `Úkol-${String(i).padStart(2, '0')}`);
    world.points['EBC-PS'] = names.map((name) => ({ name, value: '1' }));
    await refresh(boot(dir));
    world.points['EBC-PS'] = names.map((name) => ({ name, value: '2' }));
    const seen: string[] = [];
    for (let run = 0; run < 4; run++) {
      const r = await refresh(boot(dir));
      for (const line of r.changed?.points ?? []) {
        const m = /Points changed in EBC-PS: .*(Úkol-\d\d)/.exec(line);
        if (m) seen.push(m[1]!);
      }
    }
    expect(seen.sort()).toEqual(names);
  }, 60_000);
});
