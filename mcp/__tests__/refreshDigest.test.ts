// S6 of the acceptance scenarios (docs/superpowers/specs/2026-11-25-reis-for-claude-map-
// acceptance.md) with a fixed clock: the refresh report's upcoming window is the 14-day look a
// weekly digest takes, so every event is in it at 14, 7, 3 and 1 days out, with the attendance
// flag; a past event is gone; an event whose source file was replaced is listed as recheck, not
// dropped. And the digest prompt keeps the rules the routine depends on.
import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
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

import { boot } from './mapKit';
import { world, link } from './overviewKit';
import { folder, refresh } from './refreshKit';

const test9 = {
  action: 'add',
  title: 'Zápočtový test 1',
  kind: 'credit_test',
  code: 'EBC-PE',
  date: '2026-12-10',
  time: '09:00',
  room: 'Q01',
  source_kind: 'course_file',
  source_url: link(2),
  source_file: 'harmonogram.pdf',
  source_modified: '1. 10. 2026',
};
const defence20 = {
  action: 'add',
  title: 'Obhajoba projektu',
  kind: 'defence',
  code: 'EBC-PS',
  date: '2026-12-21',
  source_kind: 'student',
};
const past = {
  action: 'add',
  title: 'Průběžný test',
  kind: 'test',
  code: 'EBC-PS',
  date: '2026-11-20',
  source_kind: 'student',
};

const at = (iso: string) => vi.setSystemTime(new Date(`${iso}T11:00:00Z`)); // noon in Prague
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at('2026-12-01');
  // Nothing from IS itself in the window: only the ledger is under test here.
  world.boxes = [];
  world.terms = [];
});
afterEach(() => vi.useRealTimers());

async function seeded() {
  const dir = await folder();
  const s = boot(dir);
  await refresh(s);
  for (const e of [test9, defence20, past]) await s.call('mendelu_ledger', e);
  return dir;
}
const titles = (r: Awaited<ReturnType<typeof refresh>>) => (r.upcoming ?? []).map((u) => u.title);

describe('S6: the refresh report looks 14 days ahead', () => {
  it('holds the test 9 days out and not the defence 20 days out; the past event is gone', async () => {
    const r = await refresh(boot(await seeded()));
    expect(titles(r)).toEqual(['Zápočtový test 1']);
    expect(r.upcoming![0]).toMatchObject({ daysLeft: 9, attendance: 'yes' });
  });

  it('lists each event at 14, 7, 3 and 1 days before it, with the attendance flag', async () => {
    const dir = await seeded();
    const days = (iso: string, n: number) =>
      new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
    for (const e of [test9, defence20]) {
      for (const n of [14, 7, 3, 1]) {
        at(days(e.date, n));
        const item = (await refresh(boot(dir))).upcoming?.find((u) => u.title === e.title);
        expect(item, `${e.title} ${n} days before`).toMatchObject({
          daysLeft: n,
          attendance: 'yes',
        });
      }
    }
    at('2026-12-11');
    expect(titles(await refresh(boot(dir)))).not.toContain('Zápočtový test 1');
  });

  it('keeps an event whose source file was replaced, marked recheck', async () => {
    const dir = await seeded();
    world.files['EBC-PE']![0]!.modified = '28. 11. 2026';
    const r = await refresh(boot(dir));
    expect(r.upcoming?.find((u) => u.title === 'Zápočtový test 1')?.recheck).toMatch(/replaced/);
    expect(r.recheck?.map((e) => e.title)).toEqual(['Zápočtový test 1']);
  });
});

describe('the digest prompt keeps its rules', () => {
  const prompt = readFileSync(join(__dirname, '../routine/digest-prompt.md'), 'utf8');
  it.each([
    ['refresh first', /call `mendelu_refresh`/i],
    ['ledger from files', /save every dated event[^.]*`mendelu_ledger`/i],
    ['match before add', /match each event to an existing entry before you add anything/i],
    ['each entry used once', /use each candidate for at most one event/i],
    ['unchanged first', /\*\*Unchanged:\*\*[^\n]*same date and time/i],
    [
      'move only when one candidate fits each way',
      /\*\*Moved:\*\*[^\n]*ONLY when each is the only one left/,
    ],
    [
      'unclear: add and flag, never overwrite',
      /\*\*Unclear:\*\*[^\n]*overwrite nothing[^\n]*stay marked recheck/i,
    ],
    [
      'unchanged compares every detail',
      /\*\*Unchanged:\*\*[^\n]*room, rule[^\n]*Never set `source_modified` without the file's current details/,
    ],
    ['other source needs a clear match', /same subject, kind and day alone is not a match/i],
    ['occurrence by occurrence', /work occurrence by occurrence/i],
    [
      'remove only after the whole file',
      /remove only after reading the WHOLE file[^\n]*truncated[^\n]*keep the entry with its recheck mark/i,
    ],
    ['removed rule', /\*\*Removed:\*\*[^\n]*`remove`/],
    ['moved event is an update', /never `add` a second entry for an event that moved/i],
    ['a week ahead', /at least a week ahead/i],
    ['weekly 14 days', /weekly digest looks 14 days ahead/i],
    ['daily 14 days', /daily digest flags everything inside 14 days/i],
    ['draft, never send', /draft[^.]*never send/i],
    ['calendar only after yes', /nothing to the calendar until the student says yes/i],
    ['ledger id', /ledger id in the description/i],
    ['title format', /Kind – Subject \(CODE\)/],
    ['reminders', /a week, a day and an hour before/i],
    ['hand-made entries', /hand-made entr/i],
    ['missing connector', /no mail connector|connector is missing/i],
    ['reIS never sends', /reIS itself never sends mail and never writes a calendar/i],
  ])('%s', (_, rule) => expect(prompt).toMatch(rule));
});
