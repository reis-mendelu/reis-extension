// The ledger merged into "upcoming" (step 4b): soonest first, Prague days, past events gone
// after their day, IS terms not doubled, recheck from the listing, the 14-day flag.
import { describe, it, expect, afterEach } from 'vitest';
import { upcomingItems } from '../overviewUpcoming';
import { recheckReason } from '../ledgerSource';
import { finish, type LedgerEntry } from '../ledgerEntry';
import { parseFields } from '../ledgerFields';
import type { ExamRow } from '../overviewShape';

let n = 0;
const entry = (over: Record<string, unknown> = {}): LedgerEntry =>
  finish(
    parseFields({
      title: 'Test',
      kind: 'test',
      date: '2026-12-10',
      source_kind: 'student',
      code: 'EBC-PE',
      ...over,
    }) as never,
    { id: `ev-${String(++n).padStart(12, '0')}`, savedAt: '', updatedAt: '' }
  );
const at = (iso: string) => new Date(iso);
const up = (entries: LedgerEntry[], now: string, listings = {}) =>
  upcomingItems([], [], at(now), { entries, listings }).items;

describe('ordering and days left', () => {
  it('lists soonest first with days left and the attendance flag, IS terms and ledger together', () => {
    const exam: ExamRow = {
      key: 'k',
      code: 'EBC-PS',
      section: 'zkouška',
      state: 'registered',
      date: '15.12.2026',
      time: '9:00',
      room: 'Q01',
    };
    const items = upcomingItems([], [exam], at('2026-12-01T11:00:00Z'), {
      entries: [
        entry({ title: 'Pozdější', date: '2026-12-21' }),
        entry({ title: 'Brzký test', date: '2026-12-10', time: '14:00' }),
        entry({ title: 'Událost', kind: 'event', date: '2026-12-10' }),
      ],
      listings: {},
    }).items;
    expect(items.map((i) => [i.title, i.daysLeft, i.attendance, i.source])).toEqual([
      ['Událost', 9, '', 'ledger'],
      ['Brzký test', 9, 'yes', 'ledger'],
      ['zkouška, Q01', 14, 'yes', 'is-exam'],
      ['Pozdější', 20, 'yes', 'ledger'],
    ]);
  });

  it('flags what is inside 14 days, and only that', () => {
    const items = up(
      [entry({ date: '2026-12-10' }), entry({ date: '2026-12-21' })],
      '2026-12-01T11:00:00Z'
    );
    expect(items.map((i) => i.inNext14Days)).toEqual(['yes', undefined]);
  });

  it('shows a window under way as 0 days left and keeps it until its last day', () => {
    const programme = entry({
      kind: 'programme_day',
      date: '2026-12-08',
      until: '2026-12-12',
      title: 'Intenzivní program',
    });
    expect(up([programme], '2026-12-05T11:00:00Z')[0]).toMatchObject({
      daysLeft: 3,
      when: '8.12.2026 – 12.12.2026',
    });
    expect(up([programme], '2026-12-10T11:00:00Z')[0]).toMatchObject({
      daysLeft: 0,
      attendance: 'yes',
    });
    expect(up([programme], '2026-12-12T22:30:00Z')).toHaveLength(1); // 23:30 on the 12th: its last day
    expect(up([programme], '2026-12-12T23:30:00Z')).toHaveLength(0); // 00:30 on the 13th
  });
});

describe('Prague time', () => {
  const tz = process.env.TZ;
  afterEach(() => {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  });

  // Clocks change on 25 Oct 2026 (back) and 28 Mar 2027 (forward); a day is then 25 or 23 hours.
  for (const zone of ['America/Los_Angeles', 'Asia/Tokyo', 'Europe/Prague']) {
    it(`counts days on Prague's calendar across both clock changes, on a computer set to ${zone}`, () => {
      process.env.TZ = zone;
      const autumn = entry({ date: '2026-10-26' });
      expect(up([autumn], '2026-10-24T21:59:00Z')[0]!.daysLeft).toBe(2); // 23:59 on the 24th, CEST
      expect(up([autumn], '2026-10-24T22:01:00Z')[0]!.daysLeft).toBe(1); // 00:01 on the 25th: 25-hour day ahead
      expect(up([autumn], '2026-10-25T23:30:00Z')[0]!.daysLeft).toBe(0); // 00:30 on the 26th, CET
      expect(up([autumn], '2026-10-26T22:59:00Z')).toHaveLength(1); // 23:59 on the 26th, still its day
      expect(up([autumn], '2026-10-26T23:01:00Z')).toHaveLength(0); // 00:01 on the 27th

      const spring = entry({ date: '2027-03-29' });
      expect(up([spring], '2027-03-27T22:30:00Z')[0]!.daysLeft).toBe(2); // 23:30 on the 27th, CET
      expect(up([spring], '2027-03-28T22:30:00Z')[0]!.daysLeft).toBe(0); // 00:30 on the 29th, CEST (23-hour day behind)
      expect(up([spring], '2027-03-29T21:30:00Z')).toHaveLength(1); // 23:30 on the 29th
      expect(up([spring], '2027-03-29T22:30:00Z')).toHaveLength(0); // 00:30 on the 30th
    });
  }

  it('keeps an event for the whole of its day, even after its hour', () => {
    const t = entry({ date: '2026-12-10', time: '08:00' });
    expect(up([t], '2026-12-10T15:00:00Z')).toHaveLength(1);
    expect(up([t], '2026-12-10T23:00:00Z')).toHaveLength(0);
  });
});

describe('past events and IS terms', () => {
  it('drops an event after its day', () => {
    const t = entry({ date: '2026-11-30' });
    expect(up([t], '2026-11-30T22:00:00Z')).toHaveLength(1);
    expect(up([t], '2026-11-30T23:30:00Z')).toHaveLength(0);
  });

  it('does not double an exam term IS already lists for the same subject and time', () => {
    const exam: ExamRow = {
      key: 'k',
      code: 'EBC-PE',
      section: 'zápočet',
      state: 'registered',
      date: '10.12.2026',
      time: '09:00',
      room: 'Q01',
    };
    const items = upcomingItems([], [exam], at('2026-12-01T11:00:00Z'), {
      entries: [entry({ time: '09:00', kind: 'credit_test' }), entry({ time: '13:00' })],
      listings: {},
    }).items;
    expect(items.map((i) => [i.source, i.when])).toEqual([
      ['is-exam', '10.12.2026 09:00'],
      ['ledger', '10.12.2026 13:00'],
    ]);
  });

  it('says an inferred date is inferred and to confirm it', () => {
    const [i] = up(
      [entry({ basis: 'inferred', inferred_how: 'the 12th week starts 14 Dec' })],
      '2026-12-01T11:00:00Z'
    );
    expect(i).toMatchObject({
      basis: 'inferred',
      confirm: expect.stringMatching(/12th week.*Confirm with the teacher/),
    });
  });

  it('cuts a long list and says how many more', () => {
    const many = Array.from({ length: 25 }, (_, k) =>
      entry({ date: `2026-12-${String(k + 2).padStart(2, '0')}` })
    );
    const r = upcomingItems([], [], at('2026-12-01T11:00:00Z'), { entries: many, listings: {} });
    expect([r.items.length, r.more]).toEqual([20, 5]);
  });
});

describe('recheck', () => {
  const url = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=2;id=1;z=1';
  const sourced = () =>
    entry({ source_kind: 'course_file', source_url: url, source_modified: '1. 10. 2026' });
  const listing = (modified: string) => ({
    'EBC-PE': [{ downloadUrl: url, modified, date: '1. 10. 2026' }],
  });

  it('marks an entry whose source file shows a new date, and not one whose file is as it was', () => {
    expect(recheckReason(sourced(), listing('1.10.2026'))).toBeUndefined();
    expect(recheckReason(sourced(), listing('20. 11. 2026'))).toMatch(
      /replaced in IS.*1\. 10\. 2026.*20\. 11\. 2026/
    );
    expect(up([sourced()], '2026-12-01T11:00:00Z', listing('20. 11. 2026'))[0]!.recheck).toMatch(
      /read it again/
    );
  });

  it("marks an entry whose file is gone, but only when that subject's listing was read", () => {
    expect(recheckReason(sourced(), { 'EBC-PE': [] })).toMatch(/no longer listed/);
    expect(recheckReason(sourced(), { 'EBC-PE': undefined })).toBeUndefined();
    expect(recheckReason(sourced(), {})).toBeUndefined();
  });

  it('never marks an entry that has no source file', () => {
    expect(recheckReason(entry(), listing('20. 11. 2026'))).toBeUndefined();
  });
});
