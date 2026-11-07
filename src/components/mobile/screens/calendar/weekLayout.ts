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
 * comes from the day column itself — see `weekColumnMinWidths`.
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

/**
 * The CSS variables both Týden rows define (the chips and the columns): the
 * gap between days, and the floor of a day without a clash — its chip's label,
 * measured at 390 and 320 ("Po 16" 41px / 31px; today's filled date 47px /
 * 40px). Both rows set the same values, so one formula lands on one width.
 */
export const WEEK_ROW_VARS =
  '[--wk-gap:6px] [--wk-day:42px] [--wk-today:48px] max-[359px]:[--wk-gap:2px] max-[359px]:[--wk-day:32px] max-[359px]:[--wk-today:40px]';

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
 * Every day's CSS `min-width`, for the Týden columns and their chips alike, so
 * the two stay in line. Every column and chip is `flex: 1 1 0`, so flexbox
 * holds each day at its floor and shares what is left equally. No measuring.
 *
 * - A day without a clash keeps its chip's width (`--wk-day`, `--wk-today`),
 *   or its equal share where seven days leave less.
 * - A clashing day wants `MIN_LANE_PX` per lane, but no more than its lanes'
 *   fair share of the row (two lanes of six: 2/6), nor more than the other
 *   days' floors leave. So on a 320px phone every lesson ends up about equally
 *   wide, and the row never overflows.
 */
export function weekColumnMinWidths(
  lessons: BlockLesson[],
  days: string[],
  todayIso: string
): Record<string, string> {
  const lanes = dayLanes(lessons, days);
  const lanesOf = (iso: string) => lanes[iso] ?? 1;
  const n = days.length;
  const total = days.reduce((sum, iso) => sum + lanesOf(iso), 0);
  const clashLanes = days.reduce((sum, iso) => sum + (lanesOf(iso) > 1 ? lanesOf(iso) : 0), 0);
  const singles = days.filter((iso) => lanesOf(iso) === 1);
  const plain = singles.filter((iso) => iso !== todayIso).length;
  const floors = [
    plain > 0 ? `${plain} * var(--wk-day)` : '',
    singles.includes(todayIso) ? 'var(--wk-today)' : '',
  ].filter(Boolean);
  const row = `(100% - ${n - 1} * var(--wk-gap))`;
  const rest = floors.length ? `(${row} - ${floors.join(' - ')})` : row;
  const ratio = (a: number, b: number) => (a / b).toFixed(4);

  return Object.fromEntries(
    days.map((iso) => {
      const l = lanesOf(iso);
      if (l === 1) {
        const floor = iso === todayIso ? 'var(--wk-today)' : 'var(--wk-day)';
        return [iso, `min(${floor}, calc(${row} / ${n}))`];
      }
      const fair = `calc(${row} * ${ratio(l, total)})`;
      const left = `calc(${rest} * ${ratio(l, clashLanes)})`;
      return [iso, `min(${l * MIN_LANE_PX}px, ${fair}, ${left})`];
    })
  );
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
