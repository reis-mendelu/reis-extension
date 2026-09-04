import type { OutletMenu } from '../types/menuTypes';

/** One outlet's offering for a single day. */
export interface OutletDayMenu {
  outlet: string;
  soup: string | null;
  mainDishes: string[];
}

/**
 * The key both sides of the comparison are reduced to: `D.M`, no padding, no
 * year.
 *
 * The SKM page heads each day with free text — "Pondělí 8. 9. 2026" in Czech,
 * "Monday 8. 9. 2026" in English — so the only reliable anchor is the first
 * `D. M.` pair in the string. That is what the desktop weekly header has always
 * matched on; this is the same regex, lifted out of it so the phone can use it
 * too rather than growing a second copy that drifts.
 *
 * The year is deliberately not part of the key. The page carries two weeks, so
 * the month is enough to separate them, and no heading is ever a year away from
 * the day being asked about.
 */
export function menuDateKey(value: string | Date): string {
  if (value instanceof Date) return `${value.getDate()}.${value.getMonth() + 1}`;
  const m = value.match(/(\d+)\.\s*(\d+)\./);
  return m ? `${parseInt(m[1]!)}.${parseInt(m[2]!)}` : '';
}

/**
 * Every outlet serving on `date`, in the order the menu lists them.
 *
 * An outlet with a heading for the day but nothing under it is closed rather
 * than serving an empty menu, and is dropped — otherwise a weekend or a public
 * holiday renders as three empty outlets instead of "nothing today".
 */
export function menuForDay(menu: OutletMenu[] | null, date: Date): OutletDayMenu[] {
  if (!menu?.length) return [];
  const key = menuDateKey(date);
  const out: OutletDayMenu[] = [];
  for (const outlet of menu) {
    const day = outlet.days.find((d) => menuDateKey(d.date) === key);
    if (!day) continue;
    if (!day.soup && day.mainDishes.length === 0) continue;
    out.push({ outlet: outlet.outlet, soup: day.soup, mainDishes: day.mainDishes });
  }
  return out;
}
