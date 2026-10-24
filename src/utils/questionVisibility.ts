import type { Question } from '../types/questions';

/**
 * Which questions this device shows now. The server already returns only live
 * questions, but the list is also served from the IndexedDB cache, so the
 * window is judged again here, against the store's clock. Targeting is decided
 * here too, on the device: the faculty never leaves it.
 *
 * Not the event rules (`dropPastEvents`): a question has its own start and end
 * instants, not an event day.
 */
export function visibleQuestions(
  list: Question[],
  { nowMs, facultyKey }: { nowMs: number; facultyKey: string | null }
): Question[] {
  return list.filter((q) => {
    const start = Date.parse(q.startsAt);
    const end = Date.parse(q.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    if (nowMs < start || nowMs >= end) return false;
    if (!q.faculties) return true;
    return facultyKey !== null && q.faculties.includes(facultyKey);
  });
}
