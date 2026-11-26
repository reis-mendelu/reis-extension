// The download path build and refresh share (buildDownload.ts), at its edges: a file IS declares
// past the per-file limit is a size skip and the rest go on, a forget during the last download is
// reported as such, a text the store refuses is not counted, and a replaced file is charged only
// for what it adds. Made-up names only.
import { it, describe, expect, vi, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

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

import { lib, bootLib, tempDir, files } from './buildKit';

const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true });
});
async function folder() {
  const t = await tempDir();
  roots.push(t.root);
  return t.dir;
}
const BUILD = 'mendelu_build_my_map';

describe('the shared download path', () => {
  it('a file IS declares over the per-file limit is a size skip; the others are downloaded', async () => {
    lib.files[0]!.length = 200 * 1024 * 1024; // declared 200 MB, with less budget room than that
    const s = bootLib(await folder(), 30_000);
    const r = await s.json(BUILD, { dry_run: false });
    expect(r.stoppedAtBudget).toBe(false);
    expect(r.skippedFiles).toEqual([
      expect.objectContaining({ file: 'harmonogram.txt', reason: 'skipped: over 100 MB' }),
    ]);
    expect(r.downloaded).toBe(3);
  });

  it('a forget during the last download is reported as forgotten', async () => {
    lib.files = [lib.files[0]!];
    const dir = await folder();
    let release!: () => void;
    lib.hold = new Promise<void>((r) => (release = r));
    const running = bootLib(dir).json(BUILD, { dry_run: false });
    await vi.waitFor(() => expect(lib.downloads).toHaveLength(1));
    await bootLib(dir).json('mendelu_forget_everything');
    release();
    const r = await running;
    expect(String(r.note)).toMatch(/forgotten while it ran/);
    expect(r.downloaded).toBe(0);
  });

  it('a text the store refuses is not counted, and the original stays downloaded', async () => {
    const s = bootLib(await folder());
    const write = s.store.write.bind(s.store);
    vi.spyOn(s.store, 'write').mockImplementation((p, ...rest) =>
      p.startsWith('text/') ? Promise.resolve(false) : write(p, ...rest)
    );
    const r = await s.json(BUILD, { dry_run: false });
    expect(r).toMatchObject({ downloaded: 4, textSaved: 0, failed: 0 });
  });

  it('a replaced file is charged only for what it adds to the budget', async () => {
    lib.files = [{ name: 'data.zip', type: 'application/zip', body: 'z'.repeat(20_000) }];
    const dir = await folder();
    await bootLib(dir).json(BUILD, { dry_run: false });
    const used = (await bootLib(dir).store.usage()).bytes;
    lib.modified = '21. 11. 2025'; // the teacher replaced it with one the same size
    const tight = bootLib(dir, used + 2_000);
    const r = await tight.json(BUILD, { dry_run: false });
    expect(r).toMatchObject({ downloaded: 1, stoppedAtBudget: false });
  });

  it('a record left behind by an evicted body earns no credit for bytes that are gone', async () => {
    lib.files = [{ name: 'data.zip', type: 'application/zip', body: 'z'.repeat(20_000) }];
    const dir = await folder();
    await bootLib(dir).json(BUILD, { dry_run: false });
    const body = (await files(dir)).find((f) => f.endsWith('/data.zip'))!;
    await rm(join(dir, body)); // the body went, its record stayed
    const left = bootLib(dir);
    await left.store.rebuild();
    const used = (await left.store.usage()).bytes;
    const tight = bootLib(dir, used + 2_000);
    const r = await tight.json(BUILD, { dry_run: false });
    expect(r).toMatchObject({ downloaded: 0, stoppedAtBudget: true });
  });
});
