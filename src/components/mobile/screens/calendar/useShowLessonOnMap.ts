import type { BlockLesson } from '../../../../types/calendarTypes';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { roomCodeFor, routeSuggestionFor } from '../../../../utils/mobile/lessonActions';
import { CAMPUS_NAVIGATION_ENABLED } from '../../../../utils/routing/navigationEnabled';
import { eventIdFromRsvpBlock } from '../../../../utils/rsvpBlocks';

/**
 * What "show on map" does for a calendar row: the agenda's pin and the
 * up-next card's "Trasa →" both land here, so the two cannot disagree.
 *
 * An answered society event goes to the EVENT. Its block's "room" is a venue in
 * town, or nothing at all when the society only dropped a pin, and
 * `focusRoomByCode` with either leaves the student on an unfocused campus
 * overview. The route suggestion is cleared rather than left over from the last
 * lesson tapped — there is no campus walk to a place in town.
 */
export function useShowLessonOnMap(): (lesson: BlockLesson) => void {
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const focusEventById = useAppStore((s) => s.focusEventById);
  const suggestRoute = useAppStore((s) => s.suggestRoute);
  const { language } = useTranslation();

  return (lesson) => {
    setMobileTab('map');
    const eventId = lesson.isCustom ? eventIdFromRsvpBlock(lesson.customEventId ?? '') : null;
    if (eventId) {
      focusEventById(eventId, { fly: true });
      if (CAMPUS_NAVIGATION_ENABLED) suggestRoute(null);
      return;
    }
    focusRoomByCode(roomCodeFor(lesson));
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
