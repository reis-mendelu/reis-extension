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

import { is, tempDir, boot, textOf, files, type Result } from './mapKit';
import { world, link } from './overviewKit';

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

  it('is an error, not a map, while there is no login', async () => {
    const { root, dir } = await tempDir();
    const r: Result = await boot(dir, { unavailable: 'No login.' }).call(O);
    expect(r.isError).toBe(true);
    await done(root);
  });
});
