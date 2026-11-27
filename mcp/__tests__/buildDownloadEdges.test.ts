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

import { lib, bootLib, tempDir, files, fetchLib } from './buildKit';
import { createStore } from '../store';
import { plan } from '../buildPlan';
import { downloadPlanned } from '../buildDownload';

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

  it('a copy under an older name that could not be removed still counts in the budget', async () => {
    lib.files = [{ name: 'stare.zip', type: 'application/zip', body: 'z'.repeat(20_000) }];
    const dir = await folder();
    await bootLib(dir).json(BUILD, { dry_run: false });
    lib.files = [{ name: 'nove.zip', type: 'application/zip', body: 'y'.repeat(20_000) }];
    lib.modified = '21. 11. 2025';
    const store = createStore({ dir });
    vi.spyOn(store, 'remove').mockRejectedValue(new Error('EBUSY'));
    const ctx = { fetch: fetchLib };
    const { planned } = await plan({ ctx, store, run: (_t, _a, fn) => fn() });
    const token = { gen: (await store.generation()) ?? null, at: Date.now() };
    const { outcomes, budget } = await downloadPlanned(
      { store, ctx, token, saveText: async () => true, extractsText: false },
      planned
    );
    expect([...outcomes.values()].map((o) => o.state)).toEqual(['downloaded']);
    expect(budget.used).toBe((await store.usage()).bytes);
  });

  it('three downloads at once keep the budget count exact', async () => {
    lib.files = [1, 2, 3].map((n) => ({
      name: `cast${n}.zip`,
      type: 'application/zip',
      body: String(n).repeat(5_000 * n),
    }));
    const dir = await folder();
    const store = createStore({ dir });
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Staggered downloads and one slow folder count: other files reserve while it runs.
    const list = store.list.bind(store);
    let calls = 0;
    // The first file's count after its save is the slowest: it finishes after the others reserved.
    vi.spyOn(store, 'list').mockImplementation(
      async () => (await wait(++calls === 4 ? 400 : 5), list())
    );
    const ctx = {
      fetch: (async (u: string) => {
        await wait(60 * Number(/download=(\d+)/.exec(u)?.[1] ?? 0));
        return fetchLib(u);
      }) as unknown as typeof fetch,
    };
    const { planned } = await plan({ ctx, store, run: (_t, _a, fn) => fn() });
    const token = { gen: (await store.generation()) ?? null, at: Date.now() };
    const { outcomes, budget } = await downloadPlanned(
      { store, ctx, token, saveText: async () => true, extractsText: false, concurrency: 3 },
      planned
    );
    expect([...outcomes.values()].map((o) => o.state)).toEqual([
      'downloaded',
      'downloaded',
      'downloaded',
    ]);
    expect(budget.used).toBe((await store.usage()).bytes);
  });
});
