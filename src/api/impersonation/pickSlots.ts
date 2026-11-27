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
  const drop = new Set<BlockLesson>();
  for (const seminars of byCode.values()) {
    const byDate = new Map<string, BlockLesson[]>();
    for (const l of seminars) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]);
    const colliding = [...byDate.values()].filter((ls) => new Set(ls.map(slotKey)).size > 1);
    if (colliding.length < 2) continue;
    // The parallel a student would be in: the earliest that collides. A date it
    // does not run on keeps its own earliest, so no colliding date ends empty.
    const byTime = (a: BlockLesson, b: BlockLesson) =>
      `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`);
    const chosen = slotKey(colliding.flat().sort(byTime)[0]!);
    for (const ls of colliding) {
      const keep = ls.some((l) => slotKey(l) === chosen)
        ? chosen
        : slotKey([...ls].sort(byTime)[0]!);
      for (const l of ls) if (slotKey(l) !== keep) drop.add(l);
    }
  }
  return lessons.filter((l) => !drop.has(l));
}
