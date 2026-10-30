import type { BlockLesson } from '../../../../types/calendarTypes';
import { organizeLessons } from '../../../WeeklyCalendar/utils';
import { toIso } from '../../../../utils/mobile/weekDays';

/**
 * Layout maths for the phone's week grid, kept pure so it can be tested
 * without a browser. Lane assignment is the desktop grid's own
 * `organizeLessons` — the same overlap rules on both trees — but the vertical
 * scale is not: the desktop draws a fixed 7–21 and scrolls, and a phone screen
 * must fit without scrolling, so the range here is fitted to the week.
 */

export interface HourRange {
  /** Whole hours: 7–19 draws twelve rows. */
  start: number;
  end: number;
}

/** A working day, so an empty week still reads as a calendar. */
const EMPTY_RANGE: HourRange = { start: 8, end: 16 };
/**
 * Fewer rows than this and one lesson becomes a block the height of the
 * screen, which reads as "this takes all day".
 */
const MIN_HOURS = 8;

function minutesOf(hhmm: string): number {
  const [h = NaN, m = NaN] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** The whole hours around every lesson in the week, at least eight of them. */
export function weekHourRange(lessons: BlockLesson[]): HourRange {
  const starts = lessons.map((l) => minutesOf(l.startTime)).filter(Number.isFinite);
  const ends = lessons.map((l) => minutesOf(l.endTime)).filter(Number.isFinite);
  if (starts.length === 0 || ends.length === 0) return { ...EMPTY_RANGE };
  let start = Math.max(0, Math.floor(Math.min(...starts) / 60));
  let end = Math.min(24, Math.ceil(Math.max(...ends) / 60));
  while (end - start < MIN_HOURS) {
    if (end < 24) end++;
    else start--;
  }
  return { start, end };
}

export interface PlacedBlock {
  lesson: BlockLesson;
  /** Percent of the grid's height. */
  top: number;
  height: number;
  /** Which lane of its clash, and how many lanes the clash has. */
  lane: number;
  lanes: number;
  /**
   * Percent of the block left uncovered on a phone, where a later clash is
   * drawn over it (`blockBox`) from its own top down. Its name is clamped to
   * this, so the lines do not run on underneath the block on top.
   */
  visible: number;
}

/** One day's blocks, positioned in the fitted range. */
export function placeDay(lessons: BlockLesson[], range: HourRange): PlacedBlock[] {
  const span = (range.end - range.start) * 60;
  const placed = organizeLessons(lessons).lessons.map((l) => {
    const fromTop = minutesOf(l.startTime) - range.start * 60;
    const minutes = Math.min(l.renderedMinutes, span - fromTop);
    const top = (Math.max(0, fromTop) / span) * 100;
    const height = (minutes / span) * 100;
    return { lesson: l, top, height, lane: l.row, lanes: l.maxColumns || 1, visible: height };
  });
  for (const block of placed) {
    for (const over of placed) {
      const covers =
        over.lane > block.lane && over.top >= block.top && over.top < block.top + block.height;
      if (covers) block.visible = Math.min(block.visible, over.top - block.top);
    }
  }
  return placed;
}

/** How far each later lane of a clash is indented on a phone. */
export const CASCADE_INDENT_PX = 12;

/**
 * Where a block sits across its column.
 *
 * A phone column is ~45–56px wide, and halving it for a clash left two ~20px
 * slivers that could show no text at all. So on a phone the later block is
 * indented and drawn on top — both keep a readable width — while the iPad,
 * with ~150px columns, splits them side by side as the desktop grid does.
 */
export function blockBox(
  lane: number,
  lanes: number,
  cascade: boolean
): { left: string; width: string } {
  if (cascade) {
    const indent = lane * CASCADE_INDENT_PX;
    return { left: `${indent}px`, width: indent ? `calc(100% - ${indent}px)` : '100%' };
  }
  return { left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` };
}

/** Percent from the top for the now-line, or null when it is not on this day. */
export function nowOffset(now: Date, dayIso: string, range: HourRange): number | null {
  if (toIso(now) !== dayIso) return null;
  const minutes = now.getHours() * 60 + now.getMinutes() - range.start * 60;
  const span = (range.end - range.start) * 60;
  if (minutes < 0 || minutes > span) return null;
  return (minutes / span) * 100;
}

/**
 * Whole lines of subject name a block can show above its room line.
 * Clamped rather than clipped, so a block never ends on half a line of text.
 */
export function nameLines(blockPx: number, lineHeightPx: number, reservedPx: number): number {
  return Math.max(1, Math.floor((blockPx - reservedPx) / lineHeightPx));
}
