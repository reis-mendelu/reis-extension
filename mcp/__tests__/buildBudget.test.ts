// Review findings on PR #766 (CodeRabbit): the build counts the full stored size of every
// record, so nothing it reported as downloaded is evicted later in the same run; a file with no
// name in the headers is classified by its listed name; long subject and problem lists are cut.
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

import { lib, bootLib, tempDir, files } from './buildKit';
import { fetchDualLanguageSubjects } from '../../src/api/subjects';

const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0)) await rm(r, { recursive: true, force: true });
});
async function folder() {
  const t = await tempDir();
  roots.push(t.root);
  return t.dir;
}

describe('the build budget counts whole records', () => {
  it('never loses an original it reported as downloaded, even with long links', async () => {
    const dir = await folder();
    lib.linkTail = `;x=${'a'.repeat(1500)}`; // records far over a fixed 1 KiB guess
    lib.files = Array.from({ length: 8 }, (_, i) => ({
      name: `cast${i + 1}.txt`,
      type: 'text/plain',
      body: 'x'.repeat(1000),
    }));
    const s = bootLib(dir, 30_000);
    const r = await s.json('mendelu_build_my_map', { dry_run: false });
    expect(r.stoppedAtBudget).toBe(true);
    expect(Number(r.downloaded)).toBeGreaterThan(0);
    const bodies = (await files(dir)).filter(
      (f) => f.startsWith('originals/') && !f.endsWith('.json')
    );
    expect(bodies).toHaveLength(Number(r.downloaded));
    expect((await s.store.usage()).bytes).toBeLessThanOrEqual(30_000);
  });
});

describe('a file IS sends without a name', () => {
  it('is classified by its listed name, so its text is kept', async () => {
    lib.files = [
      { name: 'poznamky.md', type: 'application/octet-stream', body: '# Test', noName: true },
    ];
    const s = bootLib(await folder());
    const r = await s.json('mendelu_build_my_map', { dry_run: false });
    expect(r).toMatchObject({ downloaded: 1, textSaved: 1 });
  });
});

describe('long lists in the build reports', () => {
  it('cuts the subject list at 25 and says how many were left out', async () => {
    const data = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`EBC-S${i + 10}`, { code: `EBC-S${i + 10}` }])
    );
    vi.mocked(fetchDualLanguageSubjects).mockImplementation((async () => ({
      subjects: { data },
    })) as never);
    const s = bootLib(await folder());
    for (const args of [{}, { dry_run: false }]) {
      const r = await s.json('mendelu_build_my_map', args);
      expect(r.subjects).toHaveLength(25);
      expect(r.moreSubjects).toBe('5 more subjects, counted in the totals above');
    }
  });
});
