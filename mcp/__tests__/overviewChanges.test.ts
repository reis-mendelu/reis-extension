// S3 of docs/superpowers/specs/2026-11-25-reis-for-claude-map-acceptance.md: a change in IS
// shows up in the next overview once. Each "process" is a store and a server on the same
// folder, so what was reported is remembered across a restart.
import { it, describe, expect, vi } from 'vitest';
import { rm } from 'node:fs/promises';

vi.mock('../../src/utils/userParams', () => ({
  getUserParams: vi.fn().mockResolvedValue({
    studium: 'S',
    obdobi: 'O',
    studyForm: 'K',
    studyProgram: 'PI',
    studyYear: 1,
    studySemester: 1,
    facultyLabel: 'PEF',
    fullName: 'Test Student',
  }),
}));
vi.mock('../../src/injector/dataFetchers', () => ({ fetchFullSemesterSchedule: vi.fn() }));
vi.mock('../../src/api/exams', () => ({ fetchDualLanguageExams: vi.fn() }));
vi.mock('../../src/api/subjects', () => ({ fetchDualLanguageSubjects: vi.fn() }));
vi.mock('../../src/api/studyPlan', () => ({ fetchDualLanguageStudyPlan: vi.fn() }));
vi.mock('../../src/api/syllabus', async (orig) => ({
  ...(await orig<typeof import('../../src/api/syllabus')>()),
  fetchSyllabus: vi.fn(),
}));
vi.mock('../../src/api/successRate', () => ({ fetchSubjectSuccessRates: vi.fn() }));
vi.mock('../../src/api/gradeHistory', () => ({ fetchGradeHistory: vi.fn() }));
vi.mock('../../src/api/odevzdavarny', () => ({ fetchOdevzdavarny: vi.fn() }));
vi.mock('../../src/api/zaznamnik', () => ({ fetchSubjectZaznamnik: vi.fn() }));
vi.mock('../../src/api/documents/service', () => ({ fetchFolderListing: vi.fn() }));

import { CHARACTER_LIMIT } from '../format';
import { tempDir, boot, textOf } from './mapKit';
import { world, link } from './overviewKit';
const O = 'mendelu_overview';
const ask = async (dir: string) => textOf(await boot(dir).call(O));
const changed = (t: string) =>
  t.split('\n').filter((l) => /^\s*- (New|Replaced|File gone|Points|Assignment|Subject)/.test(l));
const done = (root: string) => rm(root, { recursive: true, force: true });

describe('what changed (S3)', () => {
  it('lists a new file once, and the next overview does not repeat it', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.files['EBC-PE']!.push({ id: 3, file: 'podminky.pdf', modified: '2. 12. 2026' });
    const after = await ask(dir); // a new server process on the same folder
    expect(changed(after)).toEqual([expect.stringContaining('New file in EBC-PE: podminky.pdf')]);
    expect(after).toContain(link(3));
    const again = await ask(dir);
    expect(changed(again)).toEqual([]);
    expect(again).toContain('Nothing changed in IS since the last overview.');
    await done(root);
  });

  it('says a replaced file (same link, new date) is replaced, and a removed one is gone', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.files['EBC-PE']![0]!.modified = '5. 12. 2026';
    world.files['EBC-PS'] = [];
    const t = await ask(dir);
    expect(changed(t)).toEqual([
      expect.stringContaining('File gone from IS in EBC-PS: sit.pdf'),
      expect.stringContaining(
        'Replaced file in EBC-PE: harmonogram.pdf (modified 1. 10. 2026 -> 5. 12. 2026)'
      ),
    ]);
    await done(root);
  });

  it('reports new and changed points, a new box, a moved deadline, a new term and a new subject', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.points['EBC-PS']![0]!.value = '15';
    world.points['EBC-PS']!.push({ name: 'Test 2', value: '3' });
    world.boxes[0]!.deadline = '7.1.2100 12:00';
    world.boxes.push({ name: 'Esej', deadline: '1.2.2100 12:00' });
    world.terms.push({ id: 't2', date: '19.01.2027', time: '10:00' });
    world.subjects.push('EBC-NEW');
    world.files['EBC-NEW'] = [
      { id: 9, file: 'a.pdf', modified: '1. 12. 2026' },
      { id: 10, file: 'b.pdf', modified: '1. 12. 2026' },
    ];
    const t = await ask(dir);
    expect(changed(t).map((l) => l.trim())).toEqual([
      '- New subject: EBC-NEW Předmět EBC-NEW',
      expect.stringContaining('Points changed in EBC-PS: Průběžné hodnocení / Test 1'),
      expect.stringContaining('New points row in EBC-PS: Průběžné hodnocení / Test 2'),
      expect.stringContaining(
        'Assignment deadline changed in EBC-PS: Projekt, 31.12.2099 23:59 -> 7.1.2100 12:00'
      ),
      expect.stringContaining('New assignment box in EBC-PS: Esej'),
      expect.stringContaining('New exam term in EBC-PS: zkouška 19.01.2027 10:00'),
    ]);
    // the new subject's two files are one line, not two "new file" lines
    expect(t).not.toContain('New file in EBC-NEW');
    expect(changed(await ask(dir))).toEqual([]);
    await done(root);
  });

  it('a term filling up is not news', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    const t = await ask(dir);
    expect(t).toContain('Nothing changed');
    await done(root);
  });
});

describe('a second overview inside the cache TTL', () => {
  it('sees what changed in IS, while other tools still answer from the cache', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call(O);
    world.files['EBC-PE']!.push({ id: 3, file: 'podminky.pdf', modified: '2. 12. 2026' });
    world.points['EBC-PS']![0]!.value = '15';
    world.boxes.push({ name: 'Esej', deadline: '1.2.2100 12:00' });
    world.terms.push({ id: 't2', date: '19.01.2027', time: '10:00' });
    const t = textOf(await s.call(O)); // same process, seconds later
    expect(changed(t)).toEqual([
      expect.stringContaining('Points changed in EBC-PS'),
      expect.stringContaining('New file in EBC-PE: podminky.pdf'),
      expect.stringContaining('New assignment box in EBC-PS: Esej'),
      expect.stringContaining('New exam term in EBC-PS'),
    ]);
    const listings = world.listings;
    await s.call('mendelu_subject_files', { code: 'EBC-PE' });
    await s.call('mendelu_subject_files', { code: 'EBC-PE' });
    expect(world.listings).toBe(listings); // the overview's fresh listing is what they reuse
    await done(root);
  });
});

describe('an upload too big for one answer', () => {
  const upload = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: 100 + i,
      file: `prednaska_${i}_uvod_do_problematiky_final_verze.pdf`,
      modified: '2. 12. 2026',
    }));

  for (const format of ['markdown', 'json'] as const) {
    it(`is answered within the limit (${format}), never cut`, async () => {
      const { root, dir } = await tempDir();
      await ask(dir);
      world.files['EBC-PE']!.push(...upload(400));
      const t = textOf(await boot(dir).call(O, { response_format: format }));
      expect(t.length).toBeLessThanOrEqual(CHARACTER_LIMIT);
      expect(t).not.toContain('[truncated');
      if (format === 'json') expect(() => JSON.parse(t)).not.toThrow();
      await done(root);
    });
  }

  it('is reported in parts: what an answer left out is not recorded, and comes next time', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.files['EBC-PE']!.push(...upload(400));
    const seen = new Set<string>();
    let rounds = 0;
    for (; rounds < 40; rounds++) {
      const t = textOf(await boot(dir).call(O, { response_format: 'json' }));
      expect(t.length).toBeLessThanOrEqual(CHARACTER_LIMIT);
      const out = JSON.parse(t) as {
        note: string;
        subjects: { files?: { changed?: string; url: string }[] }[];
      };
      const rows = out.subjects.flatMap((s) => s.files ?? []).filter((f) => f.changed);
      if (!rows.length) {
        expect(out.note).toContain('Nothing changed');
        break;
      }
      for (const f of rows) {
        expect(seen.has(f.url)).toBe(false); // each file listed once
        seen.add(f.url);
      }
      if (seen.size < 400) expect(out.note).toContain('come with the next call');
    }
    expect(seen.size).toBe(400);
    expect(rounds).toBeGreaterThan(1); // it really did not fit in one
    await done(root);
  });
});
