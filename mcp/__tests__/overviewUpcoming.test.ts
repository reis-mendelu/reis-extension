import { describe, it, expect } from 'vitest';
import { upcomingItems } from '../overviewUpcoming';
import type { BoxRow, ExamRow } from '../overviewShape';

const now = new Date(2026, 10, 25, 12, 0); // 25 Nov 2026, noon
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
