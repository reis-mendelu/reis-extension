import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { firstSlotOnly, oneSeminarParallel } from '../pickSlots';
import type { BlockLesson } from '../../../types/schedule';
import { readTimetableAnswer } from '../timetableQuery';

// Real EBC-FT dated timetable for year 2 (predmet=164066; rocnik=2), ZS 2026/27.
// 36 lessons: lecture Thu 09:00 Q02 (12), seminars Tue 09:00 Q31 (12) and Tue 13:00 Q31 (12).
const a = readTimetableAnswer(
  readFileSync(
    resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures/rozvrh-predmet-ft.cz.json'),
    'utf8'
  )
);
const weekday = (d: string) =>
  new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`).getUTCDay();

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

const sem = (code: string, date: string, start: string, room: string) =>
  ({
    courseCode: code,
    isSeminar: 'true',
    date,
    startTime: start,
    room,
    roomStructured: { name: room, id: room },
  }) as BlockLesson;
const lec = (code: string, date: string, start: string) =>
  ({ ...sem(code, date, start, 'Q02'), isSeminar: 'false' }) as BlockLesson;

describe('oneSeminarParallel (year 1, programme + group query)', () => {
  // Real ZF B-RASZ shape, ZS 2026/27: ZABAH's four seminar parallels carry no
  // group in IS, so every group's query returns all four on one Tuesday.
  const zabah = ['20260929', '20261013'].flatMap((d) => [
    sem('ZABAH', d, '15:00', 'A414'),
    sem('ZABAH', d, '09:00', 'A412'),
    sem('ZABAH', d, '11:00', 'A412'),
    sem('ZABAH', d, '13:00', 'A412'),
  ]);

  it('keeps the earliest parallel of a subject whose seminars collide on one date', () => {
    const kept = oneSeminarParallel([...zabah, lec('ZABAH', '20260929', '07:00')]);
    expect(
      kept.filter((l) => l.isSeminar === 'true').map((l) => `${l.date} ${l.startTime}`)
    ).toEqual(['20260929 09:00', '20261013 09:00']);
    expect(kept.filter((l) => l.isSeminar === 'false')).toHaveLength(1);
  });

  it('leaves a subject alone whose two seminar slots fall on different days (TAVKA1)', () => {
    const tavka = [
      sem('TAVKA1', '20260924', '13:00', 'X02'),
      sem('TAVKA1', '20261001', '13:00', 'X02'),
      sem('TAVKA1', '20261016', '07:00', 'B Virtuální 6'),
    ];
    expect(oneSeminarParallel(tavka)).toEqual(tavka);
  });

  it('narrows per subject, not across subjects', () => {
    const two = [sem('A', '20260929', '09:00', 'Q01'), sem('B', '20260929', '11:00', 'Q01')];
    expect(oneSeminarParallel(two)).toEqual(two);
  });

  it('keeps a slot that never collides: only the colliding parallels are narrowed', () => {
    const lab = ['20260924', '20261001', '20261008'].map((d) => sem('X', d, '07:00', 'LAB'));
    const parallels = ['20260929', '20261006'].flatMap((d) => [
      sem('X', d, '09:00', 'A412'),
      sem('X', d, '11:00', 'A412'),
    ]);
    const kept = oneSeminarParallel([...lab, ...parallels]).map((l) => `${l.date} ${l.startTime}`);
    expect(kept).toEqual([
      '20260924 07:00',
      '20261001 07:00',
      '20261008 07:00',
      '20260929 09:00',
      '20261006 09:00',
    ]);
  });

  it('leaves a one-off block day alone: a collision on a single date is not parallels', () => {
    const weekly = ['20261001', '20261008'].map((d) => sem('Y', d, '13:00', 'Q01'));
    const block = ['08:00', '10:00', '12:00'].map((t) => sem('Y', '20261120', t, 'Q02'));
    expect(oneSeminarParallel([...weekly, ...block])).toEqual([...weekly, ...block]);
  });
});
