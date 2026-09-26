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
