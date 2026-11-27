// Two review findings on PR #766: a subject with an empty folder (or none) still has its row
// in both build reports, and mendelu_subject_files gives each saved original's localPath, so a
// file the overview leaves out stays locatable, without passing the answer's size budget.
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

import { lib, bootLib, tempDir } from './buildKit';
import { fetchDualLanguageSubjects } from '../../src/api/subjects';
import { fetchFolderListing } from '../../src/api/documents/service';
import { CHARACTER_LIMIT } from '../format';

const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true });
});
async function folder() {
  const t = await tempDir();
  roots.push(t.root);
  return t.dir;
}

describe('empty subjects in the build reports', () => {
  it('keeps a row with zero files for an empty folder and for a subject with none', async () => {
    const listing = vi.mocked(fetchFolderListing).getMockImplementation()!;
    vi.mocked(fetchDualLanguageSubjects).mockImplementation((async () => ({
      subjects: {
        data: {
          'EBC-XY': { code: 'EBC-XY', subjectId: '1', folderUrl: 'https://is.mendelu.cz/a?id=7' },
          'EBC-EM': { code: 'EBC-EM', subjectId: '2', folderUrl: 'https://is.mendelu.cz/a?id=8' },
          'EBC-NO': { code: 'EBC-NO', subjectId: '3' },
        },
      },
    })) as never);
    vi.mocked(fetchFolderListing).mockImplementation(((u: string) =>
      u.endsWith('id=8') ? Promise.resolve({ complete: true, files: [] }) : listing(u)) as never);
    const s = bootLib(await folder());
    const dry = await s.json('mendelu_build_my_map');
    const real = await s.json('mendelu_build_my_map', { dry_run: false });
    expect(dry.subjects).toEqual([
      { code: 'EBC-EM', files: 0, alreadySaved: 0, types: 'no files' },
      { code: 'EBC-NO', files: 0, alreadySaved: 0, types: 'no files' },
      expect.objectContaining({ code: 'EBC-XY', files: 4 }),
    ]);
    expect(
      (real.subjects as { code: string; files: number }[]).map((r) => [r.code, r.files])
    ).toEqual([
      ['EBC-EM', 0],
      ['EBC-NO', 0],
      ['EBC-XY', 4],
    ]);
  });
});

describe('mendelu_subject_files gives saved paths', () => {
  it('answers the plain listing while nothing is saved', async () => {
    const s = bootLib(await folder());
    const r = await s.json('mendelu_subject_files', { code: 'EBC-XY' });
    expect(Array.isArray(r)).toBe(true);
  });

  it('adds a localPath for each saved, current original, with the folder named once', async () => {
    const dir = await folder();
    const s = bootLib(dir);
    await s.json('mendelu_build_my_map', { dry_run: false });
    const r = (await s.json('mendelu_subject_files', { code: 'EBC-XY' })) as {
      savedFiles: string;
      files: { localPath?: string; downloadUrl: string }[];
    };
    expect(r.savedFiles).toContain(dir);
    expect(r.files).toHaveLength(4);
    for (const f of r.files) {
      expect(f.localPath).toMatch(/^originals\/[0-9a-f]{32}\/[^/]+$/);
      await expect(stat(join(dir, f.localPath!))).resolves.toBeTruthy();
    }
    // A replaced file (another date in IS) has no current original: no path is claimed.
    lib.modified = '21. 11. 2025';
    const later = bootLib(dir);
    const r2 = await later.json('mendelu_subject_files', { code: 'EBC-XY' });
    expect(Array.isArray(r2)).toBe(true);
  });

  it('stays within the size budget for a long folder, and says when paths were left out', async () => {
    const dir = await folder();
    lib.files = Array.from({ length: 70 }, (_, i) => ({
      name: `prednaska_${i}_uvod_do_problematiky_predmetu.txt`,
      type: 'text/plain',
      body: 'x',
    }));
    const s = bootLib(dir);
    await s.json('mendelu_build_my_map', { dry_run: false });
    for (const format of ['markdown', 'json']) {
      const out = await s.call('mendelu_subject_files', {
        code: 'EBC-XY',
        response_format: format,
      });
      const text = out.content[0]!.text!;
      expect(text.length).toBeLessThanOrEqual(CHARACTER_LIMIT);
      expect(text).not.toContain('[truncated');
      expect(text).toContain('originals/');
      // 70 rows fit plain in both formats; in JSON the paths only fit once the author column goes.
      if (format === 'json') expect(text).not.toContain('"author"');
    }
  }, 30_000);
});
