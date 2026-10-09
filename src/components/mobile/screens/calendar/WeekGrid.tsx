import { useRef } from 'react';
import type { BlockLesson } from '../../../../types/calendarTypes';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useWideViewport } from '../../../../hooks/ui/useWideViewport';
import { getCzechHoliday } from '../../../../utils/holidays';
import { toIso, toCompact, stepWeek, weekDays } from '../../../../utils/mobile/weekDays';
import { useSwipeSteps } from '../../primitives/useSwipeSteps';
import { useOpenLesson } from './useOpenLesson';
import { useElementHeight } from './useElementHeight';
import { WeekBlock } from './WeekBlock';
import { weekHourRange, placeDay, nowOffset } from './weekLayout';

export interface WeekGridProps {
  /** Visible lessons and the student's own events, the same set the agenda reads. */
  lessons: BlockLesson[];
  selectedIso: string;
  lessonDates: ReadonlySet<string>;
  onSelectDay: (iso: string) => void;
}

/**
 * The whole week at a glance: an hour gutter and a column per day the strip
 * above shows (`weekDays` — so a student taught on Saturdays gets a Saturday
 * column, and nobody else does).
 *
 * The columns line up under the day chips because the row repeats DayChips'
 * box model exactly — `px-2`, a `w-8` slot each side for the arrows, `gap-1`
 * around and the strip's own `gap-1.5` between days. The left slot holds the
 * hour labels; the right one stays empty so the columns do not drift.
 *
 * It never scrolls: a screen must fit (`#root` clips), so the hours are fitted
 * to the week (`weekHourRange`) and stretched to the height there is. The
 * bottom padding clears the tab bar.
 *
 * It swipes a WEEK at a time, like the strip, with the same hook and the same
 * damped offset. `touch-none` is safe here for the reason it is on the strip:
 * nothing inside scrolls.
 */
export function WeekGrid({ lessons, selectedIso, lessonDates, onSelectDay }: WeekGridProps) {
  const { language } = useTranslation();
  const now = useAppStore((s) => s.now);
  const cascade = !useWideViewport();
  const openLesson = useOpenLesson();
  const swipeRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const gridPx = useElementHeight(columnsRef);

  const todayIso = toIso(now);
  const days = weekDays(selectedIso, lessonDates, todayIso).map(toIso);
  const weekLessons = lessons.filter((l) => days.some((d) => toCompact(d) === l.date));
  const range = weekHourRange(weekLessons);
  const span = range.end - range.start;
  const hours = Array.from({ length: span + 1 }, (_, i) => range.start + i);

  // Written straight to the node, never through state — DayChips documents why.
  const setOffset = (px: number | null) => {
    const el = swipeRef.current;
    if (!el) return;
    if (px === null) {
      el.style.removeProperty('transition');
      el.style.removeProperty('transform');
      return;
    }
    el.style.transition = 'none';
    el.style.transform = `translateX(${px / 3}px)`;
  };
  const { handlers } = useSwipeSteps({
    elementRef: swipeRef,
    onMove: setOffset,
    onEnd: (steps) => {
      setOffset(null);
      if (steps !== 0) onSelectDay(stepWeek(selectedIso, steps, lessonDates, todayIso));
    },
    onCancel: () => setOffset(null),
  });

  return (
    <div
      ref={swipeRef}
      data-testid="week-grid"
      {...handlers}
      className="flex min-h-0 flex-1 touch-none gap-1 px-2 pb-[calc(6rem_+_var(--safe-bottom,0px))] pt-2 transition-transform duration-200 ease-out"
    >
      <div className="relative w-8 flex-shrink-0">
        {hours.slice(0, -1).map((h, i) => (
          <span
            key={h}
            style={{ top: `${(i / span) * 100}%` }}
            className="absolute right-1.5 -translate-y-1/2 text-[10px] font-medium tabular-nums text-base-content/60"
          >
            {h}
          </span>
        ))}
      </div>
      <div ref={columnsRef} className="relative flex flex-1 gap-1.5 max-[359px]:gap-0.5">
        {hours.map((h, i) => (
          <div
            key={h}
            style={{ top: `${(i / span) * 100}%` }}
            className="absolute inset-x-0 border-t border-base-content/10"
          />
        ))}
        {days.map((iso) => {
          const holiday = getCzechHoliday(
            new Date(`${iso}T00:00:00`),
            language === 'en' ? 'en' : 'cz'
          );
          const dayLessons = weekLessons.filter((l) => l.date === toCompact(iso));
          const nowAt = nowOffset(now, iso, range);
          return (
            <div
              key={iso}
              title={holiday ?? undefined}
              // Today's column is washed so "where is today" is answered at a
              // glance in every week view; a holiday is washed red, as its
              // chip's dot is.
              className={`relative flex-1 rounded-lg ${
                holiday ? 'bg-error/10' : iso === todayIso ? 'bg-primary/10' : ''
              }`}
            >
              {placeDay(dayLessons, range).map((block) => (
                <WeekBlock
                  key={block.lesson.id}
                  block={block}
                  cascade={cascade}
                  gridPx={gridPx}
                  onOpen={openLesson}
                />
              ))}
              {nowAt !== null && (
                <div
                  data-testid="week-now-line"
                  style={{ top: `${nowAt}%` }}
                  className="pointer-events-none absolute -left-1 right-0 z-20 flex -translate-y-1/2 items-center"
                >
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-error" />
                  <span className="h-0.5 flex-1 bg-error" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="w-8 flex-shrink-0" />
    </div>
  );
}
