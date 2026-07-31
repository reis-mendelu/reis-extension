import type { BlockLesson } from '../../types/calendarTypes';

export interface NowNext {
  current: BlockLesson;
  /** 0..100, how far through the lesson we are. */
  elapsedPct: number;
  minutesLeft: number;
  next: BlockLesson | null;
}

/** Local-midnight-relative minute offset of an "HH:MM" string. */
function minutesOfDay(hhmm: string): number {
  // Defaults keep a malformed or truncated string ("8", "") from indexing off
  // the end — the schedule is parsed from IS HTML, so it is not guaranteed.
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function compactDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The "Teď běží" hero's data. Returns null when nothing is running right now,
 * which is the common case and renders no card at all.
 */
export function resolveNowNext(lessons: BlockLesson[], now: Date): NowNext | null {
  const today = compactDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todays = lessons
    .filter((l) => l.date === today)
    .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));

  const current = todays.find(
    (l) => minutesOfDay(l.startTime) <= nowMin && nowMin < minutesOfDay(l.endTime)
  );
  if (!current) return null;

  const start = minutesOfDay(current.startTime);
  const end = minutesOfDay(current.endTime);
  const span = Math.max(end - start, 1);
  const elapsedPct = Math.min(100, Math.max(0, Math.round(((nowMin - start) / span) * 100)));

  const next = todays.find((l) => minutesOfDay(l.startTime) >= end) ?? null;

  return { current, elapsedPct, minutesLeft: end - nowMin, next };
}
