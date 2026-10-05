import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useAppStore } from '../../../../store/useAppStore';
import { toIso, toCompact, stepWeek, weekDays } from '../../../../utils/mobile/weekDays';
import { useSwipeSteps } from '../../primitives/useSwipeSteps';
import { DayChip } from './DayChip';

export interface DayChipsProps {
  selectedIso: string;
  onSelect: (iso: string) => void;
  /** Compact IS dates (YYYYMMDD) that have at least one lesson. */
  lessonDates: ReadonlySet<string>;
  /**
   * A tap on a chip, when it means more than "select this day". In the week
   * view it opens that day, while the arrows and the swipe still only move the
   * week — so they keep `onSelect`.
   */
  onPickDay?: (iso: string) => void;
  /**
   * The week view marks no selection and no dots. A chip tap there opens the
   * day, so the selected day is only the week's anchor, and the grid below
   * already shows each day's lessons.
   */
  view?: 'day' | 'week';
}

/**
 * Five weekday chips (Mon–Fri) plus the arrows that move a week at a time —
 * the phone's whole day/week switcher.
 *
 * The week is derived from the SELECTED day, not from a stored anchor — see
 * `utils/mobile/weekDays`, which now owns that arithmetic because the screen
 * header labels the same week and the two must not compute it separately.
 *
 * Moving a week needs no fetch: `syncSchedule` already stores the whole
 * semester in one go, so every week the arrows can reach is already local.
 *
 * Two routes to a different week, because the old single route was a 28px
 * chevron — "switching to the next week in the calendar has a small '>' button.
 * It feels a bit unintuitive". The strip now SWIPES, which is the gesture a
 * horizontal row of days invites and the one both native calendars use, and
 * the chevrons stay as the visible affordance that teaches it.
 *
 * They stay at the two ends, flanking the strip, and only grew: collecting them
 * into one pill on the right — the desktop header's arrangement — was tried and
 * rejected outright. On a phone the arrow on the side you are heading towards
 * is the arrow you reach for, and a pill breaks that mapping for the sake of a
 * tidier row. 44px tall now, the touch minimum the old 36px missed.
 */
export function DayChips({
  selectedIso,
  onSelect,
  lessonDates,
  onPickDay,
  view = 'day',
}: DayChipsProps) {
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  // The store's clock, as the week grid's now-line reads it: the pulse moves it,
  // so the mark crosses midnight in an app left open.
  const todayIso = toIso(useAppStore((s) => s.now));
  const days = weekDays(selectedIso, lessonDates, todayIso);

  const elementRef = useRef<HTMLDivElement>(null);
  /**
   * Written straight to the node, never through state.
   *
   * The sheet drag was reported as "not fluent, when I put my finger on it and
   * then away, it starts bugging", and the cause was an offset held in React
   * state: a render per pointermove, and a transition that a late re-render
   * left easing the very offset the finger was setting. Same rule here.
   */
  const setOffset = (px: number | null) => {
    const strip = elementRef.current;
    if (!strip) return;
    if (px === null) {
      // removeProperty, not `= ''`: `transition` is a shorthand, and blanking a
      // shorthand leaves the old value in place in some implementations, which
      // would pin `transition: none` on the strip for good.
      strip.style.removeProperty('transition');
      strip.style.removeProperty('transform');
      return;
    }
    strip.style.transition = 'none';
    // Damped rather than 1:1. The strip is not a carousel — the next week does
    // not exist beside it to be dragged into view — so following the finger
    // exactly would promise a filmstrip that is not there. A third of the
    // travel reads as "this is about to turn over".
    strip.style.transform = `translateX(${px / 3}px)`;
  };

  const { handlers } = useSwipeSteps({
    elementRef,
    onMove: setOffset,
    onEnd: (steps) => {
      setOffset(null);
      if (steps !== 0) onSelect(stepWeek(selectedIso, steps, lessonDates, todayIso));
    },
    onCancel: () => setOffset(null),
  });

  // Was h-9 w-7 — 36x28, under the 44pt touch minimum on both axes. Same
  // place, same look, bigger target and a slightly bigger glyph.
  const arrowClass =
    'flex h-11 w-8 flex-shrink-0 items-center justify-center rounded-full text-base-content/60 active:bg-base-200 active:text-[var(--tone-primary)]';

  return (
    <div className="flex flex-shrink-0 items-center gap-1 px-2 pb-2.5 pt-4">
      <button
        type="button"
        onClick={() => onSelect(stepWeek(selectedIso, -1, lessonDates, todayIso))}
        aria-label={t('mobile.calendar.prevWeek')}
        className={arrowClass}
      >
        <ChevronLeft size={22} />
      </button>
      {/* Below 360px a seven-chip week wrapped onto a second line — "Po 3" and
          "Ne 9" broke between the weekday and the date, doubling the row's
          height and leaving it ragged. The same `max-[359px]` tightening
          BottomNav and SubjectDrawerTabs already use keeps all seven on one
          line; wider phones are untouched. Measured at 320/390/430.

          touch-none on the strip, for the reason MapSheet's handle carries it:
          with the default touch-action the browser claims the gesture as a pan
          partway through and fires pointercancel, and no `preventDefault` after
          that point can get it back. The strip has no scroller inside it, so
          there is nothing here for the declaration to take away. */}
      <div
        ref={elementRef}
        data-testid="day-strip"
        {...handlers}
        className="flex flex-1 touch-none gap-1.5 transition-transform duration-200 ease-out max-[359px]:gap-0.5"
      >
        {days.map((date) => {
          const iso = toIso(date);
          // Whether the day holds anything, said in the row instead of only in
          // the agenda: "people click on days, just to find out they might be
          // empty". A DOT on the days that have something, rather than dimming
          // the ones that do not: `text-base-content/40` measured 2.51:1 in
          // the light theme, so the empty days became the hardest labels on
          // the screen to read.
          return (
            <DayChip
              key={iso}
              date={date}
              locale={locale}
              language={language === 'en' ? 'en' : 'cz'}
              isSelected={view === 'day' && iso === selectedIso}
              isToday={iso === todayIso}
              hasLessons={lessonDates.has(toCompact(iso))}
              showDot={view === 'day'}
              onClick={() => (onPickDay ?? onSelect)(iso)}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect(stepWeek(selectedIso, 1, lessonDates, todayIso))}
        aria-label={t('mobile.calendar.nextWeek')}
        className={arrowClass}
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
