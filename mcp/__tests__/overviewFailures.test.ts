// An IS that does not answer, answers with nothing, or a forget() in the middle of an overview:
// the record is never advanced past what was really reported.
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

import { tempDir, boot, textOf, files, type Result } from './mapKit';
import { world } from './overviewKit';
const O = 'mendelu_overview';
const ask = async (dir: string) => textOf(await boot(dir).call(O));
const changed = (t: string) =>
  t.split('\n').filter((l) => /^\s*- (New|Replaced|File gone|Points|Assignment|Subject)/.test(l));
const done = (root: string) => rm(root, { recursive: true, force: true });

describe('a part IS did not answer', () => {
  it('is reported, never read as gone, and not re-reported as new when it comes back', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.broken.add('EBC-PE');
    const t = await ask(dir);
    expect(t).toContain('files of EBC-PE');
    expect(t).not.toContain('File gone');
    world.broken.clear();
    expect(changed(await ask(dir))).toEqual([]);
    await done(root);
  });
});

describe('an answer that is not one', () => {
  it('no subjects where the record has some is an error, and the record is left alone', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.subjects = [];
    const r: Result = await boot(dir).call(O);
    expect(r.isError).toBe(true);
    world.subjects = ['EBC-PS', 'EBC-PE'];
    const t = await ask(dir);
    expect(changed(t)).toEqual([]);
    expect(t).toContain('Nothing changed');
    await done(root);
  });

  it('no points where the record has some keeps the record, and says so', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.points['EBC-PS'] = [];
    const t = await ask(dir);
    expect(t).toContain('points of EBC-PS: IS returned none this time');
    world.points['EBC-PS'] = [{ name: 'Test 1', value: '12' }];
    expect(changed(await ask(dir))).toEqual([]);
    await done(root);
  });

  it('two points rows with one label do not read as changed on every call', async () => {
    const { root, dir } = await tempDir();
    world.points['EBC-PS'] = [
      { name: 'Test', value: '1' },
      { name: 'Test', value: '2' },
    ];
    await ask(dir);
    expect(changed(await ask(dir))).toEqual([]);
    await done(root);
  });

  it('a new exam period with hundreds of terms is summed up, never cut off', async () => {
    const { root, dir } = await tempDir();
    await ask(dir);
    world.terms = Array.from({ length: 300 }, (_, i) => ({
      id: `n${i}`,
      date: '12.01.2027',
      time: '09:00',
    }));
    const t = textOf(await boot(dir).call(O));
    expect(t).toContain('300 new exam terms in EBC-PS');
    expect(t).not.toContain('[truncated');
    await done(root);
  });

  it('two overviews at once report a change once between them', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call(O);
    world.files['EBC-PE']!.push({ id: 3, file: 'podminky.pdf', modified: '2. 12. 2026' });
    // a new process: this one's tool cache still holds the listing it read a moment ago
    const later = boot(dir);
    const both = await Promise.all([later.call(O), later.call(O)]);
    expect(both.flatMap((r) => changed(textOf(r)))).toHaveLength(1);
    await done(root);
  });
});

describe('forget', () => {
  it('removes the record, so the next overview is a first one again', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call(O);
    expect(await files(dir)).toContain('overview/seen.json');
    await s.call('mendelu_forget_everything');
    expect(await files(dir)).not.toContain('overview/seen.json');
    expect(textOf(await boot(dir).call(O))).toContain('First overview');
    await done(root);
  });

  it('cancels the record of an overview still running when forget happens', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    let release!: () => void;
    world.hold = new Promise<void>((r) => (release = r));
    const running = s.call(O);
    await vi.waitFor(() => expect(world.listings).toBeGreaterThan(0));
    await s.call('mendelu_forget_everything');
    release();
    await running;
    expect(await files(dir)).not.toContain('overview/seen.json');
    world.hold = null;
    expect(textOf(await boot(dir).call(O))).toContain('First overview');
    await done(root);
  });
});
