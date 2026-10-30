import { useEffect, useRef, type RefObject } from 'react';
import type { BlockLesson } from '../../../../types/calendarTypes';
import type { NowNext } from '../../../../utils/mobile/nowNext';
import { useWideViewport } from '../../../../hooks/ui/useWideViewport';
import { useAppStore } from '../../../../store/useAppStore';
import { trackFeatureSignal } from '../../../../api/featureUsage';
import { PullRefreshIndicator } from '../../primitives/PullRefreshIndicator';
import { NowNextCard } from './NowNextCard';
import { WeekNowStrip } from './WeekNowStrip';
import { DayChips } from './DayChips';
import { WeekGrid } from './WeekGrid';

export interface WeekBodyProps {
  lessons: BlockLesson[];
  selectedIso: string;
  lessonDates: ReadonlySet<string>;
  nowNext: NowNext | null;
  onRoute: () => void;
  onSelectDay: (iso: string) => void;
  onOpenDay: (iso: string) => void;
  /** The whole calendar screen: a pull may start anywhere on it, as in Den. */
  pullSurfaceRef: RefObject<HTMLElement | null>;
}

/**
 * Týden under the header: what is on now, the week's days, the grid.
 *
 * The holiday banner stays Den's — the grid washes a holiday's column red. The
 * running lesson does not: "where do I go right now" is the one moment the
 * route is urgent, so it sits above the grid while a lesson runs — a compact
 * strip on a phone, the full card on an iPad (spec 2026-10-30, decision 8).
 *
 * A pull refreshes here too (decision 9) — the 5.4.0 grid had none, so the
 * same gesture did something in Den and nothing in Týden. The grid never
 * scrolls, so it is always "at its top"; a second finger or a sideways swipe
 * is not a pull (usePullToRefresh). The pull HINT stays Den's lesson.
 */
export function WeekBody({
  lessons,
  selectedIso,
  lessonDates,
  nowNext,
  onRoute,
  onSelectDay,
  onOpenDay,
  pullSurfaceRef,
}: WeekBodyProps) {
  const wide = useWideViewport();
  const gridRef = useRef<HTMLDivElement>(null);
  const scheduleRefreshing = useAppStore((s) => s.scheduleRefreshing);
  const triggerScheduleRefresh = useAppStore((s) => s.triggerScheduleRefresh);
  // How many installs use Týden at all — Tonda's "people pick a view once and
  // never switch", answered with a number (decision 15). A write, not a
  // fetch: the counter latches once per session, the database once a day.
  useEffect(() => {
    void trackFeatureSignal('calendar_week_view');
  }, []);
  return (
    <>
      {nowNext &&
        (wide ? (
          <NowNextCard data={nowNext} onRoute={onRoute} />
        ) : (
          <WeekNowStrip data={nowNext} onRoute={onRoute} />
        ))}
      <DayChips
        selectedIso={selectedIso}
        onSelect={onSelectDay}
        lessonDates={lessonDates}
        // No selection and no dots — see DayChips' `view`. The arrows and the
        // swipe move the week; a tapped day opens in Den.
        view="week"
        onOpenDay={onOpenDay}
      />
      {/* The indicator is the grid's SIBLING, as in DayBody: the refresh
          holds the referenced element down while it runs, and that must be
          the grid, not the spinner (PR #618 review). */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <PullRefreshIndicator
          scrollerRef={gridRef}
          surfaceRef={pullSurfaceRef}
          refreshing={scheduleRefreshing}
          onRefresh={triggerScheduleRefresh}
        />
        <div ref={gridRef} className="relative flex min-h-0 flex-1 flex-col">
          <WeekGrid
            lessons={lessons}
            selectedIso={selectedIso}
            lessonDates={lessonDates}
            onSelectDay={onSelectDay}
          />
        </div>
      </div>
    </>
  );
}
