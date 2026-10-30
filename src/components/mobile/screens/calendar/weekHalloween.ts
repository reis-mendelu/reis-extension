import type { BlockLesson } from '../../../../types/calendarTypes';
import { renderedBlockMinutes } from '../../../WeeklyCalendar/utils';
import { minutesOf, type HourRange } from './weekLayout';
import { toCompact } from '../../../../utils/mobile/weekDays';

/** One shown day: its iso date and its lessons in minutes from midnight. */
export interface WeekHalloweenDay {
  iso: string;
  lessons: { start: number; end: number }[];
}

export interface WeekHalloweenSpots {
  /** The column the spider hangs into, or null when none is free at the top. */
  spiderDay: string | null;
  /** How long that column is free from the grid's top, in minutes. */
  spiderFreeMin: number;
  /** Columns a pumpkin sits at the bottom of, at most two. */
  pumpkinDays: string[];
}

/**
 * The shown days with each lesson as the grid DRAWS it: from its start to its
 * rendered end (an exam's 90-minute floor), skipping a lesson without usable
 * times, which `weekHourRange` and `placeDay` skip too.
 */
export function halloweenDays(days: string[], lessons: BlockLesson[]): WeekHalloweenDay[] {
  return days.map((iso) => ({
    iso,
    lessons: lessons
      .filter((l) => l.date === toCompact(iso))
      .flatMap((l) => {
        const start = minutesOf(l.startTime);
        if (!Number.isFinite(start) || !Number.isFinite(minutesOf(l.endTime))) return [];
        return [{ start, end: start + renderedBlockMinutes(l.startTime, l.endTime, l.isExam) }];
      }),
  }));
}

/** A spider needs this much free column under the top to hang in. */
const SPIDER_FREE_MIN = 120;
/** A pumpkin needs this much free column above the bottom line to sit in. */
const PUMPKIN_FREE_MIN = 90;
const MAX_PUMPKINS = 2;
/** Pixels the spider (thread + body) and a pumpkin need to fit their gap. */
const SPIDER_MIN_PX = 70;
const PUMPKIN_MIN_PX = 36;

/**
 * Where Týden's Halloween decorations go (spec 2026-10-30). Only space no
 * lesson uses: a spider down a column free at the top, pumpkins on the bottom
 * line of columns free at the end. A block never carries one — the first
 * overlay mockup of #619 landed a spider on a lesson card.
 *
 * The spider prefers today (where the eye already is), else the rightmost free
 * column, away from the cobweb in the top-left corner. Pumpkins go right to
 * left too, skipping the spider's column so the two do not crowd one day.
 */
export function weekHalloweenSpots(
  days: WeekHalloweenDay[],
  range: HourRange,
  todayIso: string,
  /** The grid's pixels per minute; a gap must fit the drawing in pixels too. */
  pxPerMin = Infinity
): WeekHalloweenSpots {
  const top = range.start * 60;
  const bottom = range.end * 60;
  const freeTop = (d: WeekHalloweenDay) =>
    d.lessons.length ? Math.min(...d.lessons.map((l) => l.start)) - top : bottom - top;
  const freeEnd = (d: WeekHalloweenDay) =>
    d.lessons.length ? bottom - Math.max(...d.lessons.map((l) => l.end)) : bottom - top;

  const fitsSpider = (d: WeekHalloweenDay) =>
    freeTop(d) >= SPIDER_FREE_MIN && freeTop(d) * pxPerMin >= SPIDER_MIN_PX;
  const fitsPumpkin = (d: WeekHalloweenDay) =>
    freeEnd(d) >= PUMPKIN_FREE_MIN && freeEnd(d) * pxPerMin >= PUMPKIN_MIN_PX;

  const rightToLeft = [...days].reverse();
  const today = days.find((d) => d.iso === todayIso);
  const spider = today && fitsSpider(today) ? today : rightToLeft.find(fitsSpider);

  const pumpkinDays = rightToLeft
    .filter((d) => d.iso !== spider?.iso && fitsPumpkin(d))
    .slice(0, MAX_PUMPKINS)
    .map((d) => d.iso);

  return {
    spiderDay: spider?.iso ?? null,
    spiderFreeMin: spider ? freeTop(spider) : 0,
    pumpkinDays,
  };
}
