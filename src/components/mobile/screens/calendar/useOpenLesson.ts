import type { BlockLesson } from '../../../../types/calendarTypes';
import { useAppStore } from '../../../../store/useAppStore';
import { subjectSheetFor } from '../../../../utils/mobile/lessonActions';

/**
 * What tapping a lesson does — one answer for the day agenda's row and the
 * week grid's block, so the two views cannot drift apart.
 *
 * A course opens its subject sheet (files, syllabus, classmates). A custom
 * event the student typed in themselves has no course, so `subjectSheetFor`
 * would open the drawer on an empty `courseCode`: the tap does nothing.
 */
export function useOpenLesson(): (lesson: BlockLesson) => void {
  const pushSheet = useAppStore((s) => s.pushSheet);
  return (lesson) => {
    if (lesson.isCustom) return;
    pushSheet(subjectSheetFor(lesson));
  };
}
