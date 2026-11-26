// Originals and forget, with two server processes on one folder: a read keeps its original
// once and a restart does not download it again, forget removes every original, and a build
// whose downloads are in flight when another process forgets keeps nothing afterwards.
import { it, describe, expect, vi, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';

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

import { lib, bootLib, link, tempDir, files } from './buildKit';

const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true });
});
async function folder() {
  const t = await tempDir();
  roots.push(t.root);
  return t.dir;
}
const originals = async (dir: string) =>
  (await files(dir)).filter((f) => f.startsWith('originals/'));

describe('originals and forget', () => {
  it('a read keeps the original once; after a restart it is not downloaded again', async () => {
    const dir = await folder();
    const first = bootLib(dir);
    await first.call('mendelu_subject_files', { code: 'EBC-XY' });
    await first.call('mendelu_read_file', { url: link(1) });
    expect(lib.downloads).toEqual([link(1)]);
    expect((await originals(dir)).filter((f) => !f.endsWith('.json'))).toEqual([
      expect.stringMatching(/^originals\/[0-9a-f]{32}\/harmonogram\.txt$/),
    ]);
    const second = bootLib(dir); // restart
    await second.call('mendelu_subject_files', { code: 'EBC-XY' });
    await second.call('mendelu_read_file', { url: link(1) });
    const dry = await second.json('mendelu_build_my_map');
    expect(lib.downloads).toEqual([link(1)]);
    expect(dry).toMatchObject({ alreadySaved: 1, toDownload: 3 });
  });

  it('forget everything removes every original with the rest', async () => {
    const dir = await folder();
    const s = bootLib(dir);
    await s.json('mendelu_build_my_map', { dry_run: false });
    expect((await originals(dir)).length).toBeGreaterThan(0);
    const r = await s.json('mendelu_forget_everything');
    expect(r.forgotten).toBe(true);
    expect(await files(dir)).toEqual([]);
    // And the next build starts from nothing: every file is downloaded again.
    lib.downloads = [];
    const again = await bootLib(dir).json('mendelu_build_my_map', { dry_run: false });
    expect(again).toMatchObject({ downloaded: 4, alreadySaved: 0 });
  });

  it('no original lands after another process starts forgetting, even mid-download', async () => {
    const dir = await folder();
    const builder = bootLib(dir);
    const forgetter = bootLib(dir);
    await forgetter.json('mendelu_subjects'); // the folder exists before the build starts
    let release!: () => void;
    lib.hold = new Promise<void>((r) => (release = r));
    const build = builder.json('mendelu_build_my_map', { dry_run: false });
    await vi.waitFor(() => expect(lib.downloads.length).toBeGreaterThan(0));
    const forgot = await forgetter.json('mendelu_forget_everything');
    expect(forgot.forgotten).toBe(true);
    release();
    const r = await build;
    expect(r.downloaded).toBe(0);
    expect(Number(r.failed) + Number(r.skipped)).toBe(4);
    expect(await originals(dir)).toEqual([]);
    expect((await files(dir)).filter((f) => f.startsWith('text/'))).toEqual([]);
  });
});
