// S6's core and S5's shape (docs/superpowers/specs/2026-11-25-reis-for-claude-map-acceptance.md)
// with a fixed clock: events Claude saved appear in the overview's "upcoming", survive a
// restart, are marked recheck when their source file is replaced, and are removed by forget.
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
import { world, link } from './overviewKit';

const O = 'mendelu_overview';
const L = 'mendelu_ledger';
const done = (root: string) => rm(root, { recursive: true, force: true });
type Out = {
  changed?: string[];
  upcoming?: Item[];
  entries?: Item[];
  saved?: string;
  entry?: Record<string, unknown>;
  count?: number;
  forgotten?: boolean;
};
const json = (r: Result) => JSON.parse(r.content[0]!.text!) as Out;
type Item = {
  id?: string;
  title: string;
  daysLeft: number;
  attendance: string;
  inNext14Days?: string;
  source: string;
  recheck?: string;
  basis?: string;
  confirm?: string;
};
type Srv = ReturnType<typeof boot>;
const led = (s: Srv, args: Record<string, unknown>) =>
  s.call(L, { response_format: 'json', ...args });
const upcoming = async (s: ReturnType<typeof boot>) =>
  ((json(await s.call(O, { response_format: 'json' })).upcoming ?? []) as Item[]).filter(
    (i) => i.source === 'ledger'
  );

const test9 = {
  action: 'add',
  title: 'Zápočtový test 1',
  kind: 'credit_test',
  code: 'EBC-PE',
  date: '2026-12-10',
  time: '09:00',
  room: 'Q01',
  rule: 'min. 12 bodů, bez pomůcek',
  source_kind: 'student',
};
const test20 = {
  action: 'add',
  title: 'Obhajoba projektu',
  kind: 'defence',
  code: 'EBC-PS',
  date: '2026-12-21',
  source_kind: 'student',
};

beforeEach(() => {
  // Only the clock: timers and the file system must keep running.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-01T11:00:00Z')); // noon in Prague
});
afterEach(() => vi.useRealTimers());

describe('S6: a test 9 days out is in the overview with days left and the attendance flag', () => {
  it('shows the near one in a 14-day look and the far one outside it, soonest first', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await led(s, test20);
    expect(json(await led(s, test9)).saved).toBe('added');
    const items = await upcoming(s);
    expect(items.map((i) => [i.title, i.daysLeft, i.attendance, i.inNext14Days])).toEqual([
      ['Zápočtový test 1', 9, 'yes', 'yes'],
      ['Obhajoba projektu', 20, 'yes', undefined],
    ]);
    const within14 = items.filter((i) => i.inNext14Days === 'yes');
    expect(within14.map((i) => i.title)).toEqual(['Zápočtový test 1']);
    await done(root);
  });

  it('reads the same in the markdown a student sees, next to the IS items', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await led(s, test9);
    const text = (await s.call(O)).content[0]!.text!;
    expect(text).toMatch(/Zápočtový test 1/);
    expect(text).toMatch(/ev-[0-9a-f]{12} \| 10\.12\.2026 09:00 \| 9 \|/);
    expect(text).toContain('10.12.2026 09:00');
    await done(root);
  });

  it('marks a replaced source file "recheck" on the entry and in "changed", and keeps the mark until it is fixed', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call(O); // first look: the listing and the record are saved
    const src = {
      action: 'add',
      title: 'Zápočet podle harmonogramu',
      kind: 'credit_test',
      code: 'EBC-PE',
      date: '2026-12-14',
      until: '2026-12-18',
      basis: 'inferred',
      inferred_how: '12. týden podle harmonogramu',
      source_kind: 'course_file',
      source_url: link(2),
      source_file: 'harmonogram.pdf',
      source_modified: '1. 10. 2026',
    };
    await led(s, src);
    expect((await upcoming(s))[0]).toMatchObject({
      basis: 'inferred',
      confirm: expect.stringContaining('Confirm with the teacher'),
    });
    expect((await upcoming(s))[0]!.recheck).toBeUndefined();

    world.files['EBC-PE']![0]!.modified = '20. 11. 2026'; // the teacher replaced the file
    const after = json(await boot(dir).call(O, { response_format: 'json' }));
    expect(after.changed!.join('\n')).toMatch(/Replaced file in EBC-PE: harmonogram\.pdf/);
    expect(after.changed!.join('\n')).toMatch(
      /Recheck 1 ledger entry in EBC-PE.*Zápočet podle harmonogramu/
    );
    expect(after.upcoming!.find((i: Item) => i.source === 'ledger')?.recheck).toMatch(
      /replaced in IS/
    );

    // Reported once, marked every time: never silently kept past its source.
    const again = json(await boot(dir).call(O, { response_format: 'json' }));
    expect(again.changed).toBeUndefined();
    const marked = again.upcoming!.find((i: Item) => i.source === 'ledger') as Item & {
      id: string;
    };
    expect(marked.recheck).toMatch(/replaced in IS/);

    // Claude reads the file again and says so: the mark goes.
    const listed = json(await led(s, { action: 'list' }));
    expect(listed.entries![0]!.recheck).toMatch(/replaced in IS/);
    await led(s, {
      action: 'update',
      id: marked.id,
      source_modified: '20. 11. 2026',
      date: '2026-12-15',
    });
    const fixed = (await upcoming(boot(dir)))[0]!;
    expect([fixed.recheck, fixed.daysLeft]).toEqual([undefined, 14]);
    await done(root);
  });

  it('says a vanished source file is gone, in "changed" too', async () => {
    const { root, dir } = await tempDir();
    const s = boot(dir);
    await s.call(O);
    await led(s, {
      action: 'add',
      title: 'Test z harmonogramu',
      kind: 'test',
      code: 'EBC-PE',
      date: '2026-12-09',
      source_kind: 'course_file',
      source_url: link(2),
      source_modified: '1. 10. 2026',
    });
    world.files['EBC-PE'] = [];
    const after = json(await boot(dir).call(O, { response_format: 'json' }));
    expect(after.changed!.join('\n')).toMatch(/Recheck 1 ledger entry in EBC-PE.*is gone from IS/);
    expect(after.upcoming!.find((i: Item) => i.source === 'ledger')?.recheck).toMatch(
      /no longer listed/
    );
    await done(root);
  });
});
