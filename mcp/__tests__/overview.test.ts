// S1, S3 and S4 of docs/superpowers/specs/2026-11-25-reis-for-claude-map-acceptance.md: the first
// overview, what it costs in calls, and what the student sees of a file. A change in IS is
// overviewChanges.test.ts, a failing IS and forget are overviewFailures.test.ts.
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

import { is, tempDir, boot, textOf, type Result } from './mapKit';
import { link } from './overviewKit';
const O = 'mendelu_overview';
const ask = async (dir: string) => textOf(await boot(dir).call(O));
const changed = (t: string) =>
  t.split('\n').filter((l) => /^\s*- (New|Replaced|File gone|Points|Assignment|Subject)/.test(l));
const done = (root: string) => rm(root, { recursive: true, force: true });

describe('the first overview', () => {
  it('is the whole map, says so, and downloads no file', async () => {
    const { root, dir } = await tempDir();
    const t = await ask(dir);
    expect(t).toContain('First overview on this computer');
    expect(changed(t)).toEqual([]);
    expect(t).toContain('EBC-PS');
    expect(t).toContain('EBC-PE');
    expect(t).toContain('harmonogram.pdf');
    expect(t).toContain(link(2)); // the url to hand to mendelu_read_file
    expect(is.downloads).toEqual([]);
    await done(root);
  });

  it("carries the profile, every subject's points, the deadlines, the exam term and the week", async () => {
    const { root, dir } = await tempDir();
    const t = await ask(dir);
    expect(t).toContain('K (kombinované, combined)');
    expect(t).toContain('Průběžné hodnocení / Test 1: Body=12');
    expect(t).toContain('Projekt');
    expect(t).toContain('31.12.2099 23:59');
    expect(t).toContain('12.01.2027');
    expect(t).toContain('EBC-PS'); // the lesson tomorrow
    expect(t).toContain('Q02');
    expect(t).not.toContain('Test Student');
    await done(root);
  });
});

describe('call counts (S1 and S4 of the acceptance scenarios)', () => {
  it('S1: the date that only a file knows is the overview plus one read, no listing call', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    const map = textOf(await s.call(O)); // call 1
    const url = /(https:\/\/\S+download=2\S*) \|/.exec(map)![1]!; // the harmonogram, from the map
    const read = textOf(await s.call('mendelu_read_file', { url })); // call 2
    expect(read).toContain('12. 1. 2027');
    expect(is.downloads).toHaveLength(1);
    await done(root);
  });

  it('S4: points of every subject, the deadlines, the terms and the week come in one call', async () => {
    const { root, dir } = await tempDir();
    const t = textOf(await boot(dir).call(O));
    for (const part of ['Body=12', 'none in IS yet', 'Projekt', '12.01.2027', 'seminar']) {
      expect(t).toContain(part);
    }
    await done(root);
  });
});

describe('what the student sees of a file', () => {
  it('marks a file whose text is already kept, so reading it needs no download', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call(O);
    await s.call('mendelu_read_file', { url: link(2) });
    expect(is.downloads).toHaveLength(1);
    const t = textOf(await boot(dir).call(O));
    expect(t).toMatch(/harmonogram\.pdf \| .*\| yes \|/);
    await done(root);
  });

  it('does not promise a text that was saved before any listing (no stamp), as read_file would download again', async () => {
    const { root, dir } = await tempDir();
    await boot(dir).call('mendelu_read_file', { url: link(2) }); // saved with no stamp
    expect(is.downloads).toHaveLength(1);
    const s = boot(dir);
    expect(textOf(await s.call(O))).not.toMatch(/harmonogram\.pdf \| .*\| yes \|/);
    await s.call('mendelu_read_file', { url: link(2) });
    expect(is.downloads).toHaveLength(2); // what the map implied: it is not kept
    // the second read had the listing's date, so now it is kept and the map says so
    expect(textOf(await boot(dir).call(O))).toMatch(/harmonogram\.pdf \| .*\| yes \|/);
    await done(root);
  });

  it('decides textSaved from the record header: an overview with nothing changed reads no document body', async () => {
    const { root, dir } = await tempDir();
    const first = boot(dir);
    await first.call(O);
    await first.call('mendelu_read_file', { url: link(2) });
    const later = boot(dir);
    const read = vi.spyOn(later.store, 'read');
    expect(textOf(await later.call(O))).toMatch(/harmonogram\.pdf \| .*\| yes \|/);
    expect(read.mock.calls.filter(([p]) => String(p).startsWith('text/'))).toEqual([]);
    await done(root);
  });

  it('is an error, not a map, while there is no login', async () => {
    const { root, dir } = await tempDir();
    const r: Result = await boot(dir, { unavailable: 'No login.' }).call(O);
    expect(r.isError).toBe(true);
    await done(root);
  });
});
