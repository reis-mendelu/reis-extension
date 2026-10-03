import type { BlockLesson } from '../../../../types/calendarTypes';
import { useAppStore } from '../../../../store/useAppStore';
import { subjectSheetFor } from '../../../../utils/mobile/lessonActions';
import { eventIdFromRsvpBlock } from '../../../../utils/rsvpBlocks';
import { useShowLessonOnMap } from './useShowLessonOnMap';

/**
 * What tapping a lesson does — one answer for the day agenda's row and the
 * week grid's block, so the two views cannot drift apart.
 *
 * A course opens its subject sheet (files, syllabus, classmates). A custom
 * event has no course, so `subjectSheetFor` would open the drawer on an empty
 * `courseCode` and go looking for the files of a party: an answered society
 * event goes to its place on the map instead, and an entry the student typed in
 * themselves has nothing behind it, so the tap does nothing.
 */
export function useOpenLesson(): (lesson: BlockLesson) => void {
  const pushSheet = useAppStore((s) => s.pushSheet);
  const showOnMap = useShowLessonOnMap();
  return (lesson) => {
    if (lesson.isCustom) {
      if (!eventIdFromRsvpBlock(lesson.customEventId ?? '')) return;
      showOnMap(lesson);
      return;
    }
    pushSheet(subjectSheetFor(lesson));
  };
}
