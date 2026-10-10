import roomsIndex from '../../data/map/rooms-index.json';
import buildingsJson from '../../data/map/buildings.json';
import { resolveRoomCode } from '../mobile/resolveRoomCode';
import { bracketCampus, offMapCampus } from '../rooms/roomCampus';
import type { BlockLesson } from '../../types/schedule';
import type { BuildingsMeta, RoomIndexEntry } from '../../types/campusMap';

const INDEX = roomsIndex as RoomIndexEntry[];
const BUILDING_NAME = new Map(
  (buildingsJson as BuildingsMeta).buildings.map((b) => [b.id, b.name])
);

export interface RouteTarget {
  /** The letter the routing graph joins on. */
  buildingName: string;
  /** What to show the student — "Q31", not "BA39N4051". */
  roomLabel: string;
}

export interface LessonTarget extends RouteTarget {
  startsAt: Date;
}

/** `YYYYMMDD` + `HH:MM`, in the device's own timezone, which is where the student is. */
function lessonStart(lesson: BlockLesson): Date | null {
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(lesson.date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(lesson.startTime ?? '');
  if (!d?.[1] || !d[2] || !d[3] || !t?.[1] || !t[2]) return null;
  return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
}

function lessonEnd(lesson: BlockLesson, start: Date): Date {
  const t = /^(\d{1,2}):(\d{2})$/.exec(lesson.endTime ?? '');
  if (!t?.[1] || !t[2]) return start;
  const end = new Date(start);
  end.setHours(+t[1], +t[2], 0, 0);
  return end;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

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
 * `focusRoomByCode` on an unknown room does nothing visible. FRRMS lessons do
 * resolve (budova Z has a floor plan since 2026-09); whether a WALK there is
 * offered is `canRouteFrom`'s call, and Z has no graph nodes yet.
 */
export function nextLessonTarget(lessons: BlockLesson[], now: Date): LessonTarget | null {
  const candidates = lessons
    .map((lesson) => ({ lesson, start: lessonStart(lesson) }))
    .filter((c): c is { lesson: BlockLesson; start: Date } => c.start !== null)
    .filter((c) => sameDay(c.start, now) && lessonEnd(c.lesson, c.start) > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // The EARLIEST remaining lesson, and only that one. Walking the list until
  // something resolves looks helpful and is not: a student whose 11:00 is at
  // Lednice (no floor plan, does not resolve) and whose 13:00 is in Q31
  // would be walked to Q while their actual next class is somewhere else
  // entirely. Withholding the route is the honest answer — the picker is still
  // one tap away, and it does not lie about which lesson it is taking them to.
  const next = candidates[0];
  if (!next) return null;

  const target = lessonTarget(next.lesson);
  return target && { ...target, startsAt: next.start };
}

/**
 * Where ONE lesson is, with no opinion about when it is.
 *
 * `nextLessonTarget` answers "where am I going now?" and is bounded to today
 * for a good reason. This answers "where is THIS lesson?", which is a different
 * question and needs no bound: the student tapped the pin beside a specific row
 * on a specific day, so refusing to route to Thursday would be refusing the
 * thing they asked for.
 *
 * Still `null` for a room the map cannot place. Every surveyed building (A, B,
 * C, E, M, Q, X) is in the routing graph; budova Z resolves here too but has no
 * nodes yet, and `canRouteFrom` withholds the walk for it.
 */
export function lessonTarget(lesson: BlockLesson): RouteTarget | null {
  // Both strings name the same room, so a campus off the map in the first one
  // settles it ("ZFAC1 (Led)"): there is no room to find under either name.
  if (offMapCampus(lesson.room)) return null;
  // A printed campus makes the printed room the only string to trust: its
  // structured name ("K01", "Aula", "Z14") drops the campus and would be read
  // as a different room — on Černá Pole, or by the bare-label fallback.
  const resolved = resolveRoomCode(
    bracketCampus(lesson.room) ? [lesson.room] : [lesson.room, lesson.roomStructured?.name]
  );
  if (!resolved) return null;
  const entry = INDEX.find((e) => e.code === resolved.code);
  // `buildingId === 0` is building Q — a real building. Compare against
  // undefined, never for truthiness.
  if (!entry || entry.buildingId === undefined) return null;
  const buildingName = BUILDING_NAME.get(entry.buildingId);
  if (!buildingName) return null;
  return { buildingName, roomLabel: resolved.label };
}
