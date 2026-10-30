import type { BlockLesson } from '../../../../types/calendarTypes';
import type { NowNext } from '../../../../utils/mobile/nowNext';
import { useWideViewport } from '../../../../hooks/ui/useWideViewport';
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
}

/**
 * Týden under the header: what is on now, the week's days, the grid.
 *
 * The holiday banner stays Den's — the grid washes a holiday's column red. The
 * running lesson does not: "where do I go right now" is the one moment the
 * route is urgent, so it sits above the grid while a lesson runs — a compact
 * strip on a phone, the full card on an iPad (spec 2026-10-30, decision 8).
 */
export function WeekBody({
  lessons,
  selectedIso,
  lessonDates,
  nowNext,
  onRoute,
  onSelectDay,
  onOpenDay,
}: WeekBodyProps) {
  const wide = useWideViewport();
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
      <WeekGrid
        lessons={lessons}
        selectedIso={selectedIso}
        lessonDates={lessonDates}
        onSelectDay={onSelectDay}
      />
    </>
  );
}
