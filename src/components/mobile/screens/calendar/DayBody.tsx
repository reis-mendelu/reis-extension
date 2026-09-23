import { useRef } from 'react';
import type { AgendaRow } from '../../../../utils/mobile/dayAgenda';
import { useAppStore } from '../../../../store/useAppStore';
import {
  roomCodeFor,
  routeSuggestionFor,
  subjectSheetFor,
} from '../../../../utils/mobile/lessonActions';
import { useTranslation } from '../../../../hooks/useTranslation';
import { eventIdFromRsvpBlock } from '../../../../utils/rsvpBlocks';
import { shiftIso } from '../../../../utils/mobile/weekDays';
import { DayAgenda } from './DayAgenda';
import { CalendarEmptyDay } from './CalendarEmptyDay';
import { RecentFilesStrip } from './RecentFilesStrip';
import { MenuCard } from './MenuCard';
import { useSwipeSteps } from './useSwipeSteps';
import { AlwaysScrollable } from '../../primitives/AlwaysScrollable';

export interface DayBodyProps {
  agenda: AgendaRow[];
  selectedIso: string;
  holiday: string | null;
  outsideTeaching: boolean;
  teachingStartsOn: Date | null;
  /** Swiping the day sideways moves to the next or previous one. */
  onSelectDay: (iso: string) => void;
}

/**
 * The scrolling part of the calendar screen: the day's agenda (or its empty
 * state), then the recently opened files, then lunch — the timetable first,
 * and on a full teaching day nothing below it may push the 8am lecture off the
 * screen. The two things under the agenda are the student's own (the shelf
 * follows the student, the menu follows the day), which is why they sit below
 * it on every day rather than only when the day is empty.
 *
 * It also SWIPES, a day at a time: "možnost pohybovat se pomocí swipu na
 * obrazovce". The strip above moves a week per swipe, so until now the only way
 * to reach tomorrow was to hit a chip a fifth of the screen wide — the one step
 * a calendar is asked for most had the smallest target on the screen.
 *
 * The same hook the strip uses, deliberately: one set of distance, velocity and
 * reversal rules for both, so the two gestures cannot start disagreeing about
 * how hard a swipe has to be. The hook's axis arbitration is what makes it safe
 * to put ON a scroller: it claims a gesture only once it has decided the finger
 * is going sideways, and a vertical drag is never claimed at all.
 *
 * `touch-pan-y`, not the strip's `touch-none` and not the default either. The
 * strip can take the browser's pan away outright because nothing inside it
 * scrolls; this element is the agenda, so the vertical pan has to stay native.
 * Leaving `touch-action` at its default was the first attempt and it is the bug
 * DayChips already documents from device testing: partway through a horizontal
 * drag the WebView decides the gesture is a page pan, fires `pointercancel`,
 * and no `preventDefault` after that point can win it back — the swipe simply
 * dies. `pan-y` concedes the axis we do not want and keeps the one we do.
 */
export function DayBody({
  agenda,
  selectedIso,
  holiday,
  outsideTeaching,
  teachingStartsOn,
  onSelectDay,
}: DayBodyProps) {
  const pushSheet = useAppStore((s) => s.pushSheet);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const focusEventById = useAppStore((s) => s.focusEventById);
  const suggestRoute = useAppStore((s) => s.suggestRoute);
  const { language } = useTranslation();
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * Written straight to the node, never through state — the same rule DayChips
   * carries, and for the same measured reason: a render per pointermove leaves
   * a transition easing the very offset the finger is setting.
   *
   * Damped to a third, again like the strip: the next day is not laid out
   * beside this one, so following the finger 1:1 would promise a carousel that
   * does not exist.
   */
  const setOffset = (px: number | null) => {
    const body = bodyRef.current;
    if (!body) return;
    if (px === null) {
      body.style.removeProperty('transition');
      body.style.removeProperty('transform');
      return;
    }
    body.style.transition = 'none';
    body.style.transform = `translateX(${px / 3}px)`;
  };

  const { handlers } = useSwipeSteps({
    elementRef: bodyRef,
    onMove: setOffset,
    onEnd: (steps) => {
      setOffset(null);
      // ONE day, not seven: the unit is the caller's, and this is the day view.
      if (steps !== 0) onSelectDay(shiftIso(selectedIso, steps));
    },
    onCancel: () => setOffset(null),
  });

  return (
    <div
      ref={bodyRef}
      data-testid="day-body"
      {...handlers}
      className="flex-1 touch-pan-y overflow-y-auto transition-transform duration-200 ease-out"
    >
      <AlwaysScrollable className="pb-[calc(9rem_+_var(--safe-bottom,0px))]">
        {agenda.length === 0 ? (
          <CalendarEmptyDay
            holiday={holiday}
            outsideTeaching={outsideTeaching}
            teachingStartsOn={teachingStartsOn}
          />
        ) : (
          <DayAgenda
            rows={agenda}
            // The row hands over the day's own lesson object, so there is no
            // id to look up and no week to disambiguate.
            onOpenSubject={(lesson) => {
              // A custom event has no course, so `subjectSheetFor` would open the
              // drawer on an empty `courseCode` and go looking for the files,
              // syllabus and classmates of a party. The rows only became tappable
              // when the phone started rendering them at all, so this branch is
              // part of that change rather than a separate polish.
              if (lesson.isCustom) {
                const eventId = eventIdFromRsvpBlock(lesson.customEventId ?? '');
                // An entry the student typed in themselves. There is nothing
                // behind it — switching to the map would change tabs and then log
                // "unknown event" — so the row is simply text.
                if (!eventId) return;
                setMobileTab('map');
                focusEventById(eventId, { fly: true });
                return;
              }
              pushSheet(subjectSheetFor(lesson));
            }}
            onShowOnMap={(lesson) => {
              setMobileTab('map');
              focusRoomByCode(roomCodeFor(lesson));
              // The camera move alone was the whole of this handler, and it left
              // the student looking at the right room with no way to be walked
              // to it: the map's own button asks the timetable what is next
              // TODAY, which on a Thursday row is a different building. Handing
              // the lesson over makes the button offer this one. `null` for a
              // room the map cannot place, so a previous tap's lecture is not
              // still on offer over a lesson that has none.
              suggestRoute(routeSuggestionFor(lesson, language));
            }}
          />
        )}
        <RecentFilesStrip />
        <MenuCard dayIso={selectedIso} />
      </AlwaysScrollable>
    </div>
  );
}
