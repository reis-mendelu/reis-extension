import type { BlockLesson } from '../../types/schedule';

const weekday = (yyyymmdd: string) =>
  new Date(
    Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8))
  ).getUTCDay();

/**
 * A per-subject dated query merges parallels that share a slot, and their teacher
 * lists vary week to week, so the slot key is weekday + start + room (real EBC-FT
 * data, 2026-09-26). A biweekly parallel therefore shows weekly — known v1 limit.
 */
const slotKey = (l: BlockLesson) =>
  `${weekday(l.date)}|${l.startTime}|${l.roomStructured?.id ?? l.room}`;

/** One parallel per lesson type: the slot of the earliest lecture and of the earliest seminar. */
export function firstSlotOnly(lessons: BlockLesson[]): BlockLesson[] {
  const sorted = [...lessons].sort((a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
  );
  const chosen = new Map<string, string>();
  for (const l of sorted) if (!chosen.has(l.isSeminar)) chosen.set(l.isSeminar, slotKey(l));
  return sorted.filter((l) => chosen.get(l.isSeminar) === slotKey(l));
}

/**
 * Year 1 (programme + group query): IS returns, besides the group's own
 * events, every event of the year that carries no group. Where a subject's
 * seminar parallels carry none, all of them come back, several on one date
 * (ZF B-RASZ ZABAH: four Tuesday parallels for every group, live 2026-11-27).
 * One student attends one, so the slots that collide keep their earliest.
 *
 * Narrowed only where the collision recurs (two dates or more): a one-off
 * block day is one student's day. Slots that never collide stay, so two slots
 * on different days remain a real student's week (TAVKA1).
 */
export function oneSeminarParallel(lessons: BlockLesson[]): BlockLesson[] {
  const byCode = new Map<string, BlockLesson[]>();
  for (const l of lessons)
    if (l.isSeminar === 'true') byCode.set(l.courseCode, [...(byCode.get(l.courseCode) ?? []), l]);
  const drop = new Set<string>();
  for (const [code, seminars] of byCode) {
    const perDate = new Map<string, Set<string>>();
    for (const l of seminars) {
      const keys = perDate.get(l.date) ?? new Set<string>();
      keys.add(slotKey(l));
      perDate.set(l.date, keys);
    }
    const colliding = [...perDate.values()].filter((k) => k.size > 1);
    if (colliding.length < 2) continue;
    const keys = new Set(colliding.flatMap((k) => [...k]));
    const first = seminars
      .filter((l) => keys.has(slotKey(l)))
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0];
    for (const k of keys) if (first && k !== slotKey(first)) drop.add(`${code}|${k}`);
  }
  return lessons.filter(
    (l) => l.isSeminar !== 'true' || !drop.has(`${l.courseCode}|${slotKey(l)}`)
  );
}
