import { useRef } from 'react';
import type { AgendaRow } from '../../../../utils/mobile/dayAgenda';
import { useAppStore } from '../../../../store/useAppStore';
import { roomCodeFor, subjectSheetFor } from '../../../../utils/mobile/lessonActions';
import { shiftIso } from '../../../../utils/mobile/weekDays';
import { DayAgenda } from './DayAgenda';
import { CalendarEmptyDay } from './CalendarEmptyDay';
import { RecentFilesStrip } from './RecentFilesStrip';
import { MenuCard } from './MenuCard';
import { useSwipeSteps } from './useSwipeSteps';

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
 * how hard a swipe has to be. What is NOT shared is `touch-none`: this element
 * scrolls, and taking the browser's pan away here would break the agenda. The
 * hook's axis arbitration is what makes that safe — it claims a gesture only
 * once it has decided the finger is going sideways, and a vertical drag is
 * never claimed at all.
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
      className="flex-1 overflow-y-auto pb-36 transition-transform duration-200 ease-out"
    >
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
          onOpenSubject={(lesson) => pushSheet(subjectSheetFor(lesson))}
          onShowOnMap={(lesson) => {
            setMobileTab('map');
            focusRoomByCode(roomCodeFor(lesson));
          }}
        />
      )}
      <RecentFilesStrip />
      <MenuCard dayIso={selectedIso} />
    </div>
  );
}
