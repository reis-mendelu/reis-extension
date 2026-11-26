// mendelu_build_my_map against a fake IS, with two server processes ("restart") on one folder:
// the dry run's shape, a real build, resuming, partial failure and the byte budget.
import { it, describe, expect, vi, afterEach } from 'vitest';
import { rm, stat } from 'node:fs/promises';
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

import { lib, bootLib, link, tempDir, files, fetchLib } from './buildKit';
import { buildMap } from '../buildMap';
import { createStore } from '../store';

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
  (await files(dir)).filter((f) => f.startsWith('originals/') && !f.endsWith('.json'));

describe('mendelu_build_my_map', () => {
  it('dry run (the default) counts files and types per subject, says size is unknown, downloads nothing', async () => {
    const s = bootLib(await folder());
    const r = await s.json('mendelu_build_my_map');
    expect(r).toMatchObject({
      dryRun: true,
      files: 4,
      alreadySaved: 0,
      toDownload: 4,
      totalSize: expect.stringMatching(/UNKNOWN/),
      subjects: [{ code: 'EBC-XY', files: 4, alreadySaved: 0, types: 'mat 1, md 1, txt 1, zip 1' }],
    });
    expect(String(r.note)).toMatch(/total size is UNKNOWN/);
    expect(lib.downloads).toEqual([]);
  });

  it('downloads every original, zips as they are, and keeps text where it can read it', async () => {
    const dir = await folder();
    const s = bootLib(dir);
    const r = await s.json('mendelu_build_my_map', { dry_run: false });
    expect(r).toMatchObject({ dryRun: false, downloaded: 4, failed: 0, skipped: 0, textSaved: 2 });
    expect(lib.downloads).toHaveLength(4);
    const kept = await originals(dir);
    expect(kept.map((p) => p.split('/').pop()).sort()).toEqual([
      'cviceni.zip',
      'data.mat',
      'harmonogram.txt',
      'poznamky.md',
    ]);
    const zip = kept.find((p) => p.endsWith('.zip'))!;
    expect((await stat(join(dir, zip))).size).toBe('PK-fake-zip-bytes'.length);
  });

  it('resumes after a restart: unchanged files are not downloaded again', async () => {
    const dir = await folder();
    await bootLib(dir).json('mendelu_build_my_map', { dry_run: false });
    lib.downloads = [];
    const again = bootLib(dir); // restart
    const dry = await again.json('mendelu_build_my_map');
    expect(dry).toMatchObject({ alreadySaved: 4, toDownload: 0 });
    const r = await again.json('mendelu_build_my_map', { dry_run: false });
    expect(r).toMatchObject({ downloaded: 0, alreadySaved: 4 });
    expect(lib.downloads).toEqual([]);
    // A file whose listing shows another date is downloaded again, and only that one.
    lib.modified = '21. 11. 2025';
    lib.files[0]!.body = 'Zápočet: 13. týden.';
    const third = await bootLib(dir).json('mendelu_build_my_map', { dry_run: false });
    expect(third).toMatchObject({ downloaded: 4 }); // the listing date is per folder here
    expect((await originals(dir)).length).toBe(4); // replaced in place, not added
  });

  it('reports a file that fails and keeps going', async () => {
    const dir = await folder();
    lib.files[1]!.status = 500;
    const r = await bootLib(dir).json('mendelu_build_my_map', { dry_run: false });
    expect(r).toMatchObject({ downloaded: 3, failed: 1 });
    expect(r.failedFiles).toEqual([
      { code: 'EBC-XY', file: 'cviceni.zip', reason: 'IS answered HTTP 500 for this file.' },
    ]);
    expect(await originals(dir)).toHaveLength(3);
  });

  it('stops at the byte budget and says exactly what it skipped', async () => {
    const dir = await folder();
    lib.files = Array.from({ length: 6 }, (_, i) => ({
      name: `cast${i + 1}.zip`,
      type: 'application/zip',
      body: 'x'.repeat(3000),
    }));
    const s = bootLib(dir, 10_000);
    const r = await s.json('mendelu_build_my_map', { dry_run: false });
    expect(r.stoppedAtBudget).toBe(true);
    expect(Number(r.downloaded) + Number(r.skipped)).toBe(6);
    expect(Number(r.downloaded)).toBeGreaterThan(0);
    expect(Number(r.skipped)).toBeGreaterThan(0);
    for (const f of r.skippedFiles as { reason: string }[])
      expect(f.reason).toBe('skipped: the byte budget is reached');
    expect((await s.store.usage()).bytes).toBeLessThanOrEqual(10_000);
    expect(await originals(dir)).toHaveLength(Number(r.downloaded));
  });

  it('lists each saved original in the overview with a path inside the folder', async () => {
    const dir = await folder();
    const s = bootLib(dir);
    await s.json('mendelu_build_my_map', { dry_run: false });
    const o = await s.json('mendelu_overview');
    expect(String(o.savedFiles)).toContain(dir);
    const rows = (o.subjects as { files: { url: string; localPath?: string }[] }[])[0]!.files;
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.localPath).toMatch(/^originals\/[0-9a-f]{32}\/[^/]+$/);
      await expect(stat(join(dir, row.localPath!))).resolves.toBeTruthy();
    }
    expect(rows.find((r) => r.url === link(2))!.localPath).toMatch(/cviceni\.zip$/);
  });

  it('claims no path for a file that is not saved', async () => {
    const s = bootLib(await folder());
    const o = await s.json('mendelu_overview');
    const rows = (o.subjects as { files: { localPath?: string }[] }[])[0]!.files;
    expect(rows.every((r) => r.localPath === undefined)).toBe(true);
    expect(o.savedFiles).toBeUndefined();
  });

  it('skips a file over the per-file cap with its reason, and keeps the rest', async () => {
    const store = createStore({ dir: await folder() });
    lib.files[2]!.body = 'm'.repeat(5000);
    const r = await buildMap({
      store,
      ctx: { fetch: fetchLib },
      run: (_t, _a, fn) => fn(),
      token: { gen: await store.generation(), at: Date.now() },
      saveText: async () => true,
      extractsText: true,
      dryRun: false,
      maxFileBytes: 1000,
    });
    expect(r).toMatchObject({ downloaded: 3, skipped: 1, stoppedAtBudget: false });
    expect((r as { skippedFiles: unknown[] }).skippedFiles).toEqual([
      { code: 'EBC-XY', file: 'data.mat', reason: 'skipped: over 0 MB' },
    ]);
  });

  it('refuses to download into memory when the folder cannot be written', async () => {
    const store = createStore({ dir: await folder() });
    Object.defineProperty(store, 'persistent', { get: () => false });
    await expect(
      buildMap({
        store,
        ctx: { fetch: fetchLib },
        run: (_t, _a, fn) => fn(),
        token: { gen: '', at: Date.now() },
        saveText: async () => true,
        extractsText: true,
        dryRun: false,
      })
    ).rejects.toThrow(/cannot save to its folder/);
    expect(lib.downloads).toEqual([]);
  });

  it('keeps an original too big for text extraction, without its text, and carries on', async () => {
    const store = createStore({ dir: await folder() });
    lib.files[0]!.body = 'Zápočet: 12. týden. '.repeat(100); // harmonogram.txt, over the text cap
    const saved: string[] = [];
    const r = await buildMap({
      store,
      ctx: { fetch: fetchLib },
      run: (_t, _a, fn) => fn(),
      token: { gen: await store.generation(), at: Date.now() },
      saveText: async (url) => !!saved.push(url),
      extractsText: true,
      dryRun: false,
      maxTextBytes: 500,
    });
    expect(r).toMatchObject({ downloaded: 4, failed: 0, textSaved: 1 });
    expect(saved).toEqual([link(4)]); // poznamky.md only
  });
});
