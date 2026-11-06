import type { BlockLesson } from '../../../../types/calendarTypes';
import { WeekBlock } from './WeekBlock';
import { WeekHalloweenMarks } from './WeekHalloweenMarks';
import type { WeekHalloweenSpots } from './weekHalloween';
import { placeDay, type HourRange } from './weekLayout';

export interface WeekDayColumnProps {
  iso: string;
  /** Position in the week: every other day is tinted, and all but the first get a divider. */
  index: number;
  lessons: BlockLesson[];
  range: HourRange;
  /** The column's `min-width` (dayMinWidth), the same as its chip's above. */
  minWidth: string;
  holiday: string | null;
  isToday: boolean;
  /** Percent from the top for the now-line, or null. */
  nowAt: number | null;
  wide: boolean;
  gridPx: number;
  onOpen: (lesson: BlockLesson) => void;
  halloween: { spots: WeekHalloweenSpots; spiderThread: number } | null;
}

/**
 * One day of Týden: its lessons, side by side where they clash, the now-line
 * and the Halloween marks.
 *
 * Telling the days apart (Petra via Dominik, 2026-11-06: "it can look
 * confusing and better borders would help"): every other day is tinted and a
 * hairline sits in the gap before each day but the first. Today's and a
 * holiday's wash replace the tint, so "where is today" still answers first.
 */
export function WeekDayColumn({
  iso,
  index,
  lessons,
  range,
  minWidth,
  holiday,
  isToday,
  nowAt,
  wide,
  gridPx,
  onOpen,
  halloween,
}: WeekDayColumnProps) {
  const wash = holiday
    ? 'bg-error/10'
    : isToday
      ? 'bg-primary/10'
      : index % 2 === 1
        ? 'bg-base-content/[0.05]'
        : '';
  return (
    <div
      // Where a spread lands in Den (usePinchView's dayIsoAt).
      data-day-iso={iso}
      data-testid="week-day-column"
      title={holiday ?? undefined}
      style={{ minWidth }}
      className={`relative flex-1 rounded-lg ${wash}`}
    >
      {index > 0 && (
        // In the middle of the 6px gap (2px below 360px), so it never touches
        // a block or the tint's rounded edge.
        <span
          aria-hidden="true"
          data-testid="week-day-divider"
          className="pointer-events-none absolute inset-y-0 -left-[3.5px] w-px bg-base-content/15 max-[359px]:-left-[1.5px]"
        />
      )}
      {placeDay(lessons, range).map((block) => (
        <WeekBlock
          key={block.lesson.id}
          block={block}
          wide={wide}
          gridPx={gridPx}
          onOpen={onOpen}
        />
      ))}
      {halloween && (
        <WeekHalloweenMarks
          iso={iso}
          spots={halloween.spots}
          spiderThread={halloween.spiderThread}
        />
      )}
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
}
