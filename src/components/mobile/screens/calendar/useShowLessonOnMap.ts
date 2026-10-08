import type { BlockLesson } from '../../../../types/calendarTypes';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { routeSuggestionFor } from '../../../../utils/mobile/lessonActions';
import { CAMPUS_NAVIGATION_ENABLED } from '../../../../utils/routing/navigationEnabled';

/**
 * What "show on map" does for a calendar row: the agenda's pin and the up-next
 * card's "Trasa →" both land here, so they cannot disagree.
 */
export function useShowLessonOnMap(): (lesson: BlockLesson) => void {
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const suggestRoute = useAppStore((s) => s.suggestRoute);
  const { language } = useTranslation();

  return (lesson) => {
    setMobileTab('map');
    // The room exactly as IS printed it, campus and all: "ZFAC1 (Led)" is how
    // a room with no floor plan finds its campus (lookupRoomPlace); the room
    // lookup strips the bracket itself.
    focusRoomByCode(lesson.room);
    // The camera move alone was the whole of this handler, and it left the
    // student looking at the right room with no way to be walked to it: the
    // map's own button asks the timetable what is next TODAY, which on a
    // Thursday row is a different building. Handing the lesson over makes the
    // button offer this one. `null` for a room the map cannot place, so a
    // previous tap's lecture is not still on offer over a lesson that has none.
    // Not while navigation is parked: the pin only focuses the room.
    if (CAMPUS_NAVIGATION_ENABLED) suggestRoute(routeSuggestionFor(lesson, language));
  };
}
