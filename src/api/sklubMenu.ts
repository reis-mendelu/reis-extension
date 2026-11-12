import type { VenueLunchDay } from '../types/campusMap';
import { fetchPublic } from './publicPage';

/**
 * S-klub Pixie's daily menu, scraped on the device exactly like SKM's
 * (`api/menu.ts`): `fetchPublic` goes through the content-script proxy in the
 * extension and CapacitorHttp in the apps.
 *
 * The page is not HTML a parser can walk. sklubpixie.cz is one Canva site
 * bundle (~390 KB, the same body for every path), and the week's menu sits in
 * it as a JSON array of text lines:
 *
 *   "Menu 9.11.-13.11 2026 \n", "Pondělí: Dýňový krém s mrkví (1,7,9)\n",
 *   "A) 150g Kuřecí prsíčko … (1,7)\n", "B) …", … "Pátek: …", …
 *
 * BRITTLE, like every parser here (CLAUDE.md "Parser Rules"): change it only
 * against a real capture, `__tests__/fixtures/sklub-pixie-page4.fragment.txt`.
 * Anything it cannot date is no menu rather than a wrong one.
 */
export const SKLUB_MENU_URL = 'https://sklubpixie.cz/page-4';

const HEADING = /^Menu\s+(\d{1,2})\.(\d{1,2})\.?\s*-\s*(\d{1,2})\.(\d{1,2})\.?\s+(\d{4})/;
const WEEKDAYS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const DAY_LINE = new RegExp(`^(${WEEKDAYS.join('|')})\\s*:\\s*(.*)$`);
const DISH_LINE = /^[A-Z]\)\s*(.+)$/;
/** Trailing allergen numbers: "(1,3,7,10)". Brackets inside a dish stay. */
const ALLERGENS = /\s*\(\s*\d+(?:\s*,\s*\d+)*\s*\)\s*$/;

/** The JSON array that starts at `start` ('['), or null when it does not parse. */
function arrayAt(page: string, start: number): unknown[] | null {
  let inString = false;
  let escaped = false;
  for (let i = start; i < page.length; i++) {
    const c = page[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === ']') {
      try {
        const parsed: unknown = JSON.parse(page.slice(start, i + 1));
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' from parts, plus `n` days — UTC arithmetic, so no DST edge. */
function isoDate(year: number, month: number, day: number, n = 0): string {
  return new Date(Date.UTC(year, month - 1, day + n)).toISOString().slice(0, 10);
}

/** The week's days, in the order the page lists them. Pure. */
export function parseSklubMenu(page: string): VenueLunchDay[] {
  const start = page.indexOf('["Menu ');
  if (start < 0) return [];
  const raw = arrayAt(page, start);
  if (!raw) return [];
  // The site stores its line breaks as the two characters `\n`.
  const lines = raw
    .filter((x): x is string => typeof x === 'string')
    .flatMap((x) => x.replace(/\\n/g, '\n').split('\n'))
    .map((x) => x.trim())
    .filter(Boolean);

  const heading = lines[0]?.match(HEADING);
  if (!heading) return [];
  const [day, month, endMonth] = [Number(heading[1]), Number(heading[2]), Number(heading[4])];
  // The year is the week's END's: "29.12.-2.1 2027" starts in 2026.
  const year = Number(heading[5]) - (month > endMonth ? 1 : 0);
  // Date.UTC rolls an impossible date over (31.11. → 1.12.): no menu, not a
  // wrongly dated one.
  if (isoDate(year, month, day) !== `${year}-${pad(month)}-${pad(day)}`) return [];
  // The heading's first day, as an ISO weekday (0 = Monday).
  const firstWeekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;

  const days: VenueLunchDay[] = [];
  let current: VenueLunchDay | null = null;
  for (const line of lines.slice(1)) {
    const named = line.match(DAY_LINE);
    if (named) {
      const offset = WEEKDAYS.indexOf(named[1]!) - firstWeekday;
      const soup = named[2]!.replace(ALLERGENS, '').trim();
      current = { date: isoDate(year, month, day, offset), soup: soup || null, dishes: [] };
      days.push(current);
      continue;
    }
    const dish = line.match(DISH_LINE);
    if (dish && current) current.dishes.push(dish[1]!.replace(ALLERGENS, '').trim());
  }
  return days.filter((d) => d.soup || d.dishes.length);
}

/** The week's menu, fetched and parsed. Throws when the page cannot be read. */
export async function fetchSklubMenu(): Promise<VenueLunchDay[]> {
  return parseSklubMenu(await fetchPublic(SKLUB_MENU_URL));
}
