import type { BlockLesson } from '../../types/calendarTypes';
import type { MobileSheet } from '../../store/types';
import { lessonTarget, type RouteTarget } from '../routing/nextLessonTarget';
import { localizedRoom } from '../localizedLesson';

/**
 * What a lesson row can do, as data. Both used to live inside
 * `EventDetailSheet`, which is gone: the row holds the day's own lesson, so
 * there is nothing to look up and no id/day matching to get wrong.
 */
export function subjectSheetFor(
  lesson: BlockLesson
): Extract<MobileSheet, { kind: 'subjectDrawer' }> {
  return { kind: 'subjectDrawer', courseCode: lesson.courseCode, courseName: lesson.courseName };
}

/** The room as the map knows it: IS appends " (Campus)" that `focusRoomByCode` does not want. */
export function roomCodeFor(lesson: BlockLesson): string {
  return lesson.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * The walk this lesson would be, or `null` when the map cannot place its room.
 *
 * Two labels are in play and they are not the same string. The building is what
 * the routing graph joins on ("Q"), and it comes from the room index. The room
 * is what the student is looking at — the row they tapped says "Q31", so the
 * button that appears has to say "Q31" too. `lessonTarget` answers with the
 * friendliest name the ROOM has, which for Q31 is "Učebna bankovnictví
 * Komerčka": true, and not a place the student has ever heard of.
 *
 * `null` rather than a best guess, because the caller's contract is to offer
 * the button only when there is a walk behind it.
 */
export function routeSuggestionFor(lesson: BlockLesson, language: string): RouteTarget | null {
  const target = lessonTarget(lesson);
  if (!target) return null;
  // The printed room minus the campus in brackets — the same trim `roomCodeFor`
  // does, applied to the localized string rather than the raw one.
  const printed = localizedRoom(lesson, language)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  return { buildingName: target.buildingName, roomLabel: printed || target.roomLabel };
}
