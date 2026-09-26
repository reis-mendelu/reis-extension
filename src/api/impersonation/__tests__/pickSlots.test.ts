import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { firstSlotOnly } from '../pickSlots';
import { readTimetableAnswer } from '../timetableQuery';

// Real EBC-FT dated timetable for year 2 (predmet=164066; rocnik=2), ZS 2026/27.
// 36 lessons: lecture Thu 09:00 Q02 (12), seminars Tue 09:00 Q31 (12) and Tue 13:00 Q31 (12).
const a = readTimetableAnswer(
  readFileSync(
    resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures/rozvrh-predmet-ft.cz.json'),
    'utf8'
  )
);
const weekday = (d: string) => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`).getUTCDay();

describe('firstSlotOnly', () => {
  it('keeps the lecture slot and the earliest seminar slot only', () => {
    if (a.kind !== 'lessons') throw new Error('fixture');
    expect(a.lessons).toHaveLength(36);
    const kept = firstSlotOnly(a.lessons);
    expect(kept).toHaveLength(24);
    const slots = new Set(kept.map((l) => `${l.isSeminar}|${l.startTime}|${l.room}`));
    expect(slots).toEqual(new Set(['false|09:00|Q02', 'true|09:00|Q31']));
    expect(kept.every((l) => weekday(l.date) === (l.isSeminar === 'true' ? 2 : 4))).toBe(true);
  });
  it('returns [] for []', () => expect(firstSlotOnly([])).toEqual([]));
});
