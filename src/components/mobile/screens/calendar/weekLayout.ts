import type { BlockLesson } from '../../../../types/calendarTypes';
import { organizeLessons, renderedBlockMinutes } from '../../../WeeklyCalendar/utils';
import { toIso, toCompact } from '../../../../utils/mobile/weekDays';

/**
 * Layout maths for the phone's week grid, kept pure so it can be tested
 * without a browser. Lane assignment is the desktop grid's own
 * `organizeLessons` — the same overlap rules on both trees, side by side on
 * both — but the vertical scale is not: the desktop draws a fixed 7–21 and scrolls, and a phone screen
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

export function minutesOf(hhmm: string): number {
  const [h = NaN, m = NaN] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * The whole hours around every lesson in the week, at least eight of them.
 *
 * A lesson counts only with BOTH times (a start-only record stretched the
 * range to midnight while never being drawn), and to its DRAWN end: a short
 * exam is drawn for its 90-minute floor, which was clipped at the range's end.
 */
export function weekHourRange(lessons: BlockLesson[]): HourRange {
  const spans = lessons
    .map((l) => {
      const start = minutesOf(l.startTime);
      const end = minutesOf(l.endTime);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      return { start, end: start + renderedBlockMinutes(l.startTime, l.endTime, l.isExam) };
    })
    .filter((x): x is { start: number; end: number } => x !== null);
  const starts = spans.map((x) => x.start);
  const ends = spans.map((x) => x.end);
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
}

/** One day's blocks, positioned in the fitted range. */
export function placeDay(lessons: BlockLesson[], range: HourRange): PlacedBlock[] {
  const span = (range.end - range.start) * 60;
  return organizeLessons(lessons)
    .lessons.map((l) => {
      const fromTop = minutesOf(l.startTime) - range.start * 60;
      const minutes = Math.min(l.renderedMinutes, span - fromTop);
      return {
        lesson: l,
        top: (Math.max(0, fromTop) / span) * 100,
        height: (minutes / span) * 100,
        lane: l.row,
        lanes: l.maxColumns || 1,
      };
    })
    .sort((a, b) => a.top - b.top || a.lane - b.lane);
}

/**
 * Where a block sits across its column: a clash is split side by side, an
 * equal share per lane, on every width — the desktop grid's rule.
 *
 * 5.6.0 cascaded a clash on a phone instead (the later lesson indented 12px
 * and drawn over the earlier one), which left the earlier lesson a 12px sliver
 * with one letter of its name (Dominik, 2026-11-06). Width for the lanes now
 * comes from the day column itself — see `dayMinWidth`.
 */
export function blockBox(lane: number, lanes: number): { left: string; width: string } {
  return { left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` };
}

/**
 * The narrowest a lane of a clash should be, in CSS px: a day column on a
 * 320px phone is ~45px and still reads a syllable or two a line
 * ("Eko-nome-trie"), so a lane gets about that rather than half of it.
 */
export const MIN_LANE_PX = 44;

/** The widest gap between two day columns (`gap-1.5`; 2px below 360px). */
const DAY_GAP_PX = 6;

/** How many lanes each day's widest clash needs; 1 for a day without one. */
export function dayLanes(lessons: BlockLesson[], days: string[]): Record<string, number> {
  const lanes: Record<string, number> = {};
  for (const iso of days) {
    const compact = toCompact(iso);
    const placed = organizeLessons(lessons.filter((l) => l.date === compact)).lessons;
    lanes[iso] = Math.max(1, ...placed.map((l) => l.maxColumns || 1));
  }
  return lanes;
}

/**
 * The CSS `min-width` of a day column — and of its chip above, so the two stay
 * in line. Every column is `flex: 1 1 0`, so flexbox holds a clashing day at
 * this floor and shares what is left equally among the rest. No measuring.
 *
 * A day without a clash gets an explicit 0: left at `auto`, a chip's label
 * would set its own minimum and drift out of line with the column.
 *
 * A clashing day wants `MIN_LANE_PX` per lane, but never more than its share
 * of the row by lanes (two lanes in a week of six lanes: 2/6), so on a 320px
 * phone, or with two clashing days, every lesson ends up equally wide and the
 * row never overflows. The gaps are taken at their widest for the same reason.
 */
export function dayMinWidth(lanes: number, weekLanes: number[]): string {
  if (lanes <= 1) return '0px';
  const total = weekLanes.reduce((sum, n) => sum + n, 0);
  const gaps = Math.max(0, weekLanes.length - 1) * DAY_GAP_PX;
  const share = (lanes / total).toFixed(4);
  return `min(${lanes * MIN_LANE_PX}px, calc((100% - ${gaps}px) * ${share}))`;
}

/** Every day's `min-width`, for the Týden columns and their chips alike. */
export function weekColumnMinWidths(
  lessons: BlockLesson[],
  days: string[]
): Record<string, string> {
  const lanes = dayLanes(lessons, days);
  const all = days.map((iso) => lanes[iso] ?? 1);
  return Object.fromEntries(days.map((iso) => [iso, dayMinWidth(lanes[iso] ?? 1, all)]));
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
