import { useAppStore } from '../../store/useAppStore';
import type { BlockLesson } from '../../types/calendarTypes';

/** The id of the custom event behind a calendar block, when that block is a library booking. */
export function libraryBlockId(lesson: BlockLesson): string | null {
  if (!lesson.isCustom || !lesson.customEventId) return null;
  const e = useAppStore.getState().customEvents.find((c) => c.id === lesson.customEventId);
  return e?.libraryBooking ? e.id : null;
}
