import type { HourRange } from './weekLayout';

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

/** A spider needs this much free column under the top to hang in. */
const SPIDER_FREE_MIN = 120;
/** A pumpkin needs this much free column above the bottom line to sit in. */
const PUMPKIN_FREE_MIN = 90;
const MAX_PUMPKINS = 2;

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
  todayIso: string
): WeekHalloweenSpots {
  const top = range.start * 60;
  const bottom = range.end * 60;
  const freeTop = (d: WeekHalloweenDay) =>
    d.lessons.length ? Math.min(...d.lessons.map((l) => l.start)) - top : bottom - top;
  const freeEnd = (d: WeekHalloweenDay) =>
    d.lessons.length ? bottom - Math.max(...d.lessons.map((l) => l.end)) : bottom - top;

  const rightToLeft = [...days].reverse();
  const today = days.find((d) => d.iso === todayIso);
  const spider =
    today && freeTop(today) >= SPIDER_FREE_MIN
      ? today
      : rightToLeft.find((d) => freeTop(d) >= SPIDER_FREE_MIN);

  const pumpkinDays = rightToLeft
    .filter((d) => d.iso !== spider?.iso && freeEnd(d) >= PUMPKIN_FREE_MIN)
    .slice(0, MAX_PUMPKINS)
    .map((d) => d.iso);

  return {
    spiderDay: spider?.iso ?? null,
    spiderFreeMin: spider ? freeTop(spider) : 0,
    pumpkinDays,
  };
}
