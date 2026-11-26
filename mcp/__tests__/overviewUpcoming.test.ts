import { describe, it, expect, afterEach } from 'vitest';
import { upcomingItems } from '../overviewUpcoming';
import type { BoxRow, ExamRow } from '../overviewShape';

const now = new Date('2026-11-25T11:00:00Z'); // 25 Nov 2026, noon in Prague
const exam = (date: string, time: string, state: ExamRow['state'] = 'registered'): ExamRow => ({
  key: `${date}${time}`,
  code: 'EBC-PE',
  section: 'zápočet',
  state,
  date,
  time,
  room: 'Q01',
});
const box = (deadline: string, over: Partial<BoxRow> = {}): BoxRow => ({
  key: deadline,
  code: 'EBC-PS',
  name: 'Projekt',
  deadline,
  open: true,
  submission: 'nothing_uploaded',
  points: '',
  ...over,
});

describe('upcomingItems', () => {
  it('puts registered terms and unhanded open boxes soonest first, with days left and attendance', () => {
    const { items } = upcomingItems(
      [box('9.12.2026 23:59'), box('27.11.2026 8:00', { name: 'Esej' })],
      [exam('2.12.2026', '13:00')],
      now
    );
    expect(items.map((i) => [i.title, i.daysLeft, i.attendance, i.source])).toEqual([
      ['Esej', 2, '', 'is-assignment'],
      ['zápočet, Q01', 7, 'yes', 'is-exam'],
      ['Projekt', 14, '', 'is-assignment'],
    ]);
  });

  it('leaves out open terms the student is not registered for, handed-in and closed boxes, and the past', () => {
    const { items } = upcomingItems(
      [
        box('9.12.2026 23:59', { submission: 'handed_in' }),
        box('9.12.2026 23:59', { open: false }),
        box('1.11.2026 8:00'),
      ],
      [exam('2.12.2026', '13:00', 'open'), exam('20.11.2026', '9:00')],
      now
    );
    expect(items).toEqual([]);
  });

  it('cuts a long list and says how many more', () => {
    const boxes = Array.from({ length: 25 }, (_, i) =>
      box(`${i + 1}.12.2026 10:00`, { key: String(i) })
    );
    const r = upcomingItems(boxes, [], now);
    expect([r.items.length, r.more]).toEqual([20, 5]);
  });
});

describe('IS prints Prague time, whatever the computer clock says', () => {
  const tz = process.env.TZ;
  afterEach(() => {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  });
  const left = (e: ExamRow[], iso: string) => upcomingItems([], e, new Date(iso)).items;

  for (const zone of ['America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Auckland', 'Europe/Prague']) {
    it(`keeps an exam until its Prague start time, on a computer set to ${zone}`, () => {
      process.env.TZ = zone;
      const winter = [exam('10.12.2026', '10:00')]; // CET, 09:00 UTC
      expect(left(winter, '2026-12-10T08:59:00Z')).toHaveLength(1);
      expect(left(winter, '2026-12-10T09:01:00Z')).toHaveLength(0);
      const summer = [exam('1.7.2027', '10:00')]; // CEST, 08:00 UTC
      expect(left(summer, '2027-07-01T07:59:00Z')).toHaveLength(1);
      expect(left(summer, '2027-07-01T08:01:00Z')).toHaveLength(0);
    });

    it(`counts days left in Prague days, on a computer set to ${zone}`, () => {
      process.env.TZ = zone;
      const e = [exam('10.12.2026', '10:00')];
      expect(left(e, '2026-12-09T22:30:00Z')[0]!.daysLeft).toBe(1); // 23:30 on the 9th in Prague
      expect(left(e, '2026-12-10T07:00:00Z')[0]!.daysLeft).toBe(0);
      expect(left([exam('27.3.2027', '10:00')], '2027-03-26T12:00:00Z')[0]!.daysLeft).toBe(1);
    });
  }
});
