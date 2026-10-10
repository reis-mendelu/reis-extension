import type { BlockLesson } from '../types/calendarTypes';
import type { RoomIndexEntry } from '../types/campusMap';
import roomsIndexJson from '../data/map/rooms-index.json';
import { localizedRoom } from './localizedLesson';
import { lookupRoomTarget } from './rooms/lookupRoomPlace';

const INDEX = roomsIndexJson as RoomIndexEntry[];

export interface LessonPlace {
  /** What the row prints where a room goes; '' when there is nothing to say. */
  label: string;
  /** Whether "show on map" has anywhere to go. */
  onMap: boolean;
  /**
   * Whether there is a walk behind it. A room with no floor plan still has
   * `onMap` (the map shows its building), but the routing graph only reaches
   * rooms the map draws, so "Trasa" must not appear for one.
   */
  routable: boolean;
}

/**
 * Where a calendar row is — the phone's agenda and "up next" card, and the
 * desktop grid's room line (which takes only the label: no map button there).
 *
 * A lesson's place is its room, and the map can show it only when the room
 * index knows it — the room itself, or the building/campus it is in when there
 * is no floor plan (T18 → building T).
 */
export function lessonPlace(lesson: BlockLesson, language: string): LessonPlace {
  const target = lookupRoomTarget(lesson.room, INDEX);
  return {
    label: localizedRoom(lesson, language),
    onMap: !!target,
    routable: target?.kind === 'room',
  };
}
