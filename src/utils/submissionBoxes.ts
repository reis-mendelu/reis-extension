import type { Odevzdavarna } from '../api/odevzdavarny';

/**
 * Deadline of a box, from IS's Czech `DD.MM.YYYY HH:MM` (local time).
 * The English page prints MM/DD/YYYY; the fetcher never stores that.
 */
export function boxDeadline(box: Odevzdavarna): Date | null {
  const m = box.deadline.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?: (\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
}

/**
 * Whether a student can still upload. IS's own flag decides when present; a
 * row cached by an older build has none and reads as open, and a passed
 * deadline closes a box even before the next sync says so.
 */
export function isBoxOpen(box: Odevzdavarna, now: number): boolean {
  if (box.isOpen === false) return false;
  const deadline = boxDeadline(box);
  return !deadline || deadline.getTime() > now;
}

const time = (b: Odevzdavarna) => boxDeadline(b)?.getTime() ?? Infinity;

/** Open boxes soonest first; closed ones most recent first. */
export function splitBoxes(boxes: Odevzdavarna[], now: number) {
  const open = boxes.filter((b) => isBoxOpen(b, now)).sort((a, b) => time(a) - time(b));
  const closed = boxes
    .filter((b) => !isBoxOpen(b, now))
    .sort((a, b) => (boxDeadline(b)?.getTime() ?? 0) - (boxDeadline(a)?.getTime() ?? 0));
  return { open, closed };
}

/**
 * Open boxes with nothing uploaded and a deadline within `days`. Teachers
 * leave some boxes open for the whole year, so "open" alone is not "due".
 */
export function boxesDueSoon(boxes: Odevzdavarna[], now: number, days: number) {
  const until = now + days * 86_400_000;
  return splitBoxes(boxes, now).open.filter((b) => {
    const t = boxDeadline(b)?.getTime();
    return b.fileCount === 0 && t !== undefined && t <= until;
  });
}

/**
 * The course code to open a box's subject by. The parser reads it from IS;
 * rows cached before it did fall back to the subject with the same predmet id.
 */
export function boxCourseCode(
  box: Odevzdavarna,
  subjects: Record<string, { subjectId?: string }> | undefined
): string | null {
  if (box.courseCode) return box.courseCode;
  const match = Object.entries(subjects ?? {}).find(([, s]) => s.subjectId === box.courseId);
  return match?.[0] ?? null;
}
