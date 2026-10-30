import type { BlockLesson } from '../../../../types/calendarTypes';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { subjectSheetFor } from '../../../../utils/mobile/lessonActions';
import { lessonPlace } from '../../../../utils/lessonPlace';
import { useShowLessonOnMap } from './useShowLessonOnMap';
import { libraryBlockId } from '../../../../mobile/library/libraryBlock';

/**
 * What tapping a Týden block does (spec 2026-10-30). A lesson opens its
 * subject, always — never a "subject or room?" choice, because after the
 * first week a student opens the subject almost every time. The sheet is told
 * which lesson it came from (`weekLesson`), so it can say where that one is:
 * the block has no room for a map pin.
 *
 * A society or own event has no subject. In Den its row's pin is the way to
 * the map, so here the block itself is, when the map knows the place; an own
 * event with no place does nothing, as its Den row does.
 */
export function useOpenWeekLesson(): (lesson: BlockLesson) => void {
  const pushSheet = useAppStore((s) => s.pushSheet);
  const showOnMap = useShowLessonOnMap();
  const { language } = useTranslation();
  return (lesson) => {
    const booking = libraryBlockId(lesson);
    if (booking) {
      pushSheet({ kind: 'libraryCancel', eventId: booking });
      return;
    }
    if (lesson.isCustom) {
      if (lessonPlace(lesson, language).onMap) showOnMap(lesson);
      return;
    }
    pushSheet({ ...subjectSheetFor(lesson), weekLesson: lesson });
  };
}
