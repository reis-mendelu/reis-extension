import { useAppStore } from '../../store/useAppStore';
import type { BlockLesson } from '../../types/calendarTypes';

/** The id of the custom event behind a calendar block, when that block is a library booking. */
export function libraryBlockId(lesson: BlockLesson): string | null {
  if (!lesson.isCustom || !lesson.customEventId) return null;
  const e = useAppStore.getState().customEvents.find((c) => c.id === lesson.customEventId);
  // `library:` ids from before storage kept `libraryBooking` (2026-11-16) are
  // still the library's: they lost their keys, not their meaning.
  return e && (e.libraryBooking || e.id.startsWith('library:')) ? e.id : null;
}

/** The library room behind a calendar block, when it is a library booking. */
export function libraryRoomOfBlock(lesson: BlockLesson): number | null {
  const id = libraryBlockId(lesson);
  if (!id) return null;
  const e = useAppStore.getState().customEvents.find((c) => c.id === id);
  return e?.libraryBooking?.featureId ?? null;
}
