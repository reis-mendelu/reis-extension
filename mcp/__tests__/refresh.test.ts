// mendelu_refresh (step 6 of the map; S3 of the acceptance scenarios) against a fake IS, with
// several server processes on one folder: a new file shows up once and is downloaded within the
// budget, an unchanged file is not downloaded again, a replaced harmonogram marks its ledger
// entries recheck, the budget stop and a subject that fails are reported, and a forget while it
// runs leaves nothing behind. Made-up names only.
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

import { boot, is, files } from './mapKit';
import { world, link } from './overviewKit';
import { R, folder, refresh, json } from './refreshKit';

const originals = async (dir: string) =>
  (await files(dir)).filter((f) => f.startsWith('originals/') && !f.endsWith('.json'));

describe('mendelu_refresh', () => {
  it('a first refresh records a baseline, downloads nothing and says how to build the map', async () => {
    const dir = await folder();
    const r = await refresh(boot(dir));
    expect(r.first).toBe(true);
    expect(r.note).toMatch(/mendelu_build_my_map/);
    expect(is.downloads).toEqual([]);
    const again = await refresh(boot(dir));
    expect([again.first, again.changed, again.downloaded]).toEqual([undefined, undefined, 0]);
  });

  it('a new file shows up once in what changed and is downloaded; the next refresh is quiet', async () => {
    const dir = await folder();
    await refresh(boot(dir));
    world.files['EBC-PS']!.push({ id: 3, file: 'projekt.pdf', modified: '25. 11. 2026' });
    const r = await refresh(boot(dir)); // a restart: another process on the same folder
    expect(r.changed?.files).toEqual([
      expect.objectContaining({
        code: 'EBC-PS',
        file: 'projekt.pdf',
        what: 'new',
        modified: '25. 11. 2026',
        url: link(3),
        outcome: 'downloaded',
      }),
    ]);
    expect(r.downloaded).toBe(1);
    expect(is.downloads).toEqual([link(3)]);
    expect(await originals(dir)).toHaveLength(1);
    const next = await refresh(boot(dir));
    expect(next.changed).toBeUndefined();
    expect(is.downloads).toEqual([link(3)]);
  });

  it('never downloads an unchanged file again, and a replaced one exactly once', async () => {
    const dir = await folder();
    const s = boot(dir);
    await refresh(s);
    await s.call('mendelu_build_my_map', { dry_run: false });
    expect(is.downloads).toHaveLength(2);
    is.downloads = [];
    expect((await refresh(boot(dir))).downloaded).toBe(0);
    world.files['EBC-PS']![0]!.modified = '26. 11. 2026';
    const r = await refresh(boot(dir));
    expect(r.changed?.files?.[0]).toMatchObject({ what: 'replaced', outcome: 'downloaded' });
    expect(is.downloads).toEqual([link(1)]);
    await refresh(boot(dir));
    expect(is.downloads).toEqual([link(1)]);
  });

  it('a new subject brings no downloads: its files wait for mendelu_build_my_map', async () => {
    const dir = await folder();
    await refresh(boot(dir));
    world.subjects.push('EBC-NEW');
    world.files['EBC-NEW'] = [{ id: 9, file: 'uvod.pdf', modified: '1. 11. 2026' }];
    const r = await refresh(boot(dir));
    expect(r.changed?.subjects?.join('\n')).toMatch(/EBC-NEW.*mendelu_build_my_map/);
    expect(is.downloads).toEqual([]);
  });

  it('a replaced harmonogram marks its ledger entries recheck', async () => {
    const dir = await folder();
    const s = boot(dir);
    await refresh(s);
    await s.call('mendelu_ledger', {
      action: 'add',
      title: 'Zápočtový test',
      kind: 'credit_test',
      code: 'EBC-PE',
      date: '2099-12-10',
      source_kind: 'course_file',
      source_url: link(2),
      source_file: 'harmonogram.pdf',
      source_modified: '1. 10. 2026',
    });
    world.files['EBC-PE']![0]!.modified = '20. 11. 2026';
    const r = await refresh(boot(dir));
    expect(r.changed?.ledger?.join('\n')).toMatch(/Recheck 1 ledger entry in EBC-PE/);
    expect(r.recheck).toEqual([
      expect.objectContaining({
        title: 'Zápočtový test',
        reason: expect.stringMatching(/replaced/),
      }),
    ]);
    // The mark stands until Claude reads the file again; "changed" said it once.
    const again = await refresh(boot(dir));
    expect(again.changed).toBeUndefined();
    expect(again.recheck).toHaveLength(1);
  });

  it('reports a budget stop, and the skipped file comes again with the next refresh', async () => {
    const dir = await folder();
    await refresh(boot(dir));
    world.files['EBC-PS']!.push({ id: 3, file: 'velky.pdf', modified: '25. 11. 2026' });
    const tight = boot(dir, { maxBytes: 1 });
    const r = await refresh(tight);
    expect(r.stoppedAtBudget).toBe(true);
    expect(r.skipped).toBe(1);
    expect(r.changed?.files?.[0]?.outcome).toMatch(/budget/);
    expect(await originals(dir)).toEqual([]);
    const roomy = await refresh(boot(dir));
    expect(roomy.changed?.files?.[0]).toMatchObject({ file: 'velky.pdf', outcome: 'downloaded' });
  });

  it('a subject whose listing fails is reported; the others are refreshed', async () => {
    const dir = await folder();
    await refresh(boot(dir));
    world.broken.add('EBC-PE');
    world.files['EBC-PS']!.push({ id: 3, file: 'novy.pdf', modified: '25. 11. 2026' });
    const r = await refresh(boot(dir));
    expect(r.problems?.join('\n')).toMatch(/files of EBC-PE: IS is busy/);
    expect(r.downloaded).toBe(1);
    // Nothing of EBC-PE is called gone: its part of the record is kept.
    expect(r.changed?.files?.map((f) => f.what)).toEqual(['new']);
  });

  it('keeps its own record: what the overview showed is still in the next refresh', async () => {
    const dir = await folder();
    const s = boot(dir);
    await refresh(s);
    await s.call('mendelu_overview');
    world.files['EBC-PS']!.push({ id: 3, file: 'novy.pdf', modified: '25. 11. 2026' });
    await s.call('mendelu_overview');
    const r = await refresh(boot(dir));
    expect(r.changed?.files?.map((f) => f.file)).toEqual(['novy.pdf']);
  });

  it('a forget while it downloads leaves nothing behind', async () => {
    const dir = await folder();
    await refresh(boot(dir));
    world.files['EBC-PS']!.push({ id: 3, file: 'novy.pdf', modified: '25. 11. 2026' });
    let release!: () => void;
    is.hold = new Promise<void>((r) => (release = r));
    const running = boot(dir).call(R, { response_format: 'json' });
    await vi.waitFor(() => expect(is.downloads).toHaveLength(1));
    const forgot = json(
      await boot(dir).call('mendelu_forget_everything', { response_format: 'json' })
    );
    expect(forgot).toMatchObject({ forgotten: true });
    release();
    await running;
    expect(await files(dir)).toEqual([]);
  });

  it('a bulk upload stays inside one answer and the rest comes next time', async () => {
    const dir = await folder();
    await refresh(boot(dir));
    const many = Array.from({ length: 120 }, (_, i) => ({
      id: 100 + i,
      file: `prednaska-${'s-velmi-dlouhym-nazvem-'.repeat(4)}${i}.pdf`,
      modified: '25. 11. 2026',
    }));
    world.files['EBC-PS']!.push(...many);
    const first = await boot(dir).call(R, { response_format: 'json' });
    expect(first.content[0]!.text!.length).toBeLessThanOrEqual(25_000);
    const shown = json(first).changed!.files!.length;
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(120);
    const second = json(await boot(dir).call(R, { response_format: 'json' }));
    expect(second.changed!.files!.length).toBeGreaterThan(0);
    // Every download happened once only: the second run reports, it does not fetch again.
    expect(new Set(is.downloads).size).toBe(is.downloads.length);
  }, 60_000);
});
