// mendelu_ledger list pages a long ledger: every entry is reachable with offset, one with id
// (split from ledgerKept.test.ts, which keeps the tool's other behaviour).
import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
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

import { tempDir, boot, type Result } from './mapKit';

const L = 'mendelu_ledger';
const done = (root: string) => rm(root, { recursive: true, force: true });
const json = (r: Result) => JSON.parse(r.content[0]!.text!) as Record<string, unknown>;
const led = (s: ReturnType<typeof boot>, args: Record<string, unknown>) =>
  s.call(L, { response_format: 'json', ...args });
const test9 = {
  action: 'add',
  title: 'Zápočtový test 1',
  kind: 'credit_test',
  code: 'EBC-PE',
  date: '2026-12-10',
  source_kind: 'student',
};

beforeEach(() => {
  // Only the clock: the events are dated 10 December, so a real "today" must not hide them.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-01T11:00:00Z')); // noon in Prague
});
afterEach(() => vi.useRealTimers());

describe('mendelu_ledger list paging', () => {
  it('pages a long list: every entry is reachable with offset, one with id', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    const rule = 'x'.repeat(450);
    const time = (i: number) => `${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${i % 6}0`;
    for (let i = 0; i < 60; i++)
      await led(s, { ...test9, title: `Test ${i}`, time: time(i), rule, room: 'Q01' });
    type Page = { count: number; note?: string; entries: { id: string; title: string }[] };
    const seen: string[] = [];
    let offset = 0;
    let pages = 0;
    for (;;) {
      const page = json(await led(s, { action: 'list', offset })) as unknown as Page;
      pages++;
      expect(page.count).toBe(60);
      seen.push(...page.entries.map((e) => e.id));
      if (!page.note) break;
      expect(page.note).toMatch(new RegExp(`Pass offset ${offset + page.entries.length} `));
      offset += page.entries.length;
    }
    expect(pages).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(60);
    expect(seen).toHaveLength(60);

    const some = json(await led(s, { action: 'list', limit: 5 })) as unknown as Page;
    expect(some.entries).toHaveLength(5);
    expect(some.note).toMatch(/Showing 1-5 of 60. Pass offset 5/);
    const one = json(await led(s, { action: 'list', id: seen[17] })) as unknown as Page;
    expect(one.entries.map((e) => e.id)).toEqual([seen[17]]);
    expect(one.note).toBeUndefined();
    await done(root);
  });
});
