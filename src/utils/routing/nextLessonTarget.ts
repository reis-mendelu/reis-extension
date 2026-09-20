import roomsIndex from '../../data/map/rooms-index.json';
import buildingsJson from '../../data/map/buildings.json';
import { resolveRoomCode } from '../mobile/resolveRoomCode';
import type { BlockLesson } from '../../types/schedule';
import type { BuildingsMeta, RoomIndexEntry } from '../../types/campusMap';

const INDEX = roomsIndex as RoomIndexEntry[];
const BUILDING_NAME = new Map(
  (buildingsJson as BuildingsMeta).buildings.map((b) => [b.id, b.name])
);

export interface LessonTarget {
  /** The letter the routing graph joins on. */
  buildingName: string;
  /** What to show the student — "Q31", not "BA39N4051". */
  roomLabel: string;
  startsAt: Date;
}

/** `YYYYMMDD` + `HH:MM`, in the device's own timezone, which is where the student is. */
function lessonStart(lesson: BlockLesson): Date | null {
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(lesson.date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(lesson.startTime ?? '');
  if (!d || !t) return null;
  return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
}

function lessonEnd(lesson: BlockLesson, start: Date): Date {
  const t = /^(\d{1,2}):(\d{2})$/.exec(lesson.endTime ?? '');
  if (!t) return start;
  const end = new Date(start);
  end.setHours(+t[1], +t[2], 0, 0);
  return end;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * The lesson a student is on their way to, and the building it is in.
 *
 * **Today only.** "Next lesson" without that bound cheerfully routes someone to
 * Thursday, which is not a walk anybody is about to take; with no lesson left
 * today the caller falls back to letting them pick a building.
 *
 * A lesson that has already STARTED still counts, because the student knows
 * they are late and the useful number is how much later they are about to be.
 * One that has already ended does not — walking there now helps nobody.
 *
 * Returns `null` when the room does not resolve, which is the same contract the
 * rest of the app uses: callers offer the button only when this returns, because
 * `focusRoomByCode` on an unknown room does nothing visible. Today that branch
 * catches every FRRMS lesson — budova Z is not in the My MENDELU survey, so its
 * rooms have no geometry and no building. That is the floor-plan work, not a
 * bug here, and a button that looks fine and does nothing would be worse.
 */
export function nextLessonTarget(lessons: BlockLesson[], now: Date): LessonTarget | null {
  const candidates = lessons
    .map((lesson) => ({ lesson, start: lessonStart(lesson) }))
    .filter((c): c is { lesson: BlockLesson; start: Date } => c.start !== null)
    .filter((c) => sameDay(c.start, now) && lessonEnd(c.lesson, c.start) > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const { lesson, start } of candidates) {
    const resolved = resolveRoomCode([lesson.room, lesson.roomStructured?.name]);
    if (!resolved) continue;
    const entry = INDEX.find((e) => e.code === resolved.code);
    // `buildingId === 0` is building Q — a real building. Compare against
    // undefined, never for truthiness.
    if (!entry || entry.buildingId === undefined) continue;
    const buildingName = BUILDING_NAME.get(entry.buildingId);
    if (!buildingName) continue;
    return { buildingName, roomLabel: resolved.label, startsAt: start };
  }
  return null;
}
