import type { OutletMenu } from '../src/types/menuTypes';

interface FixtureDay {
  dayOffset?: number;
  soup?: string | null;
  mainDishes?: string[];
}
interface FixtureOutlet {
  outlet?: string;
  days?: FixtureDay[];
}

/**
 * Materialise `dev/fixtures/canteenMenu.json` onto today's calendar.
 *
 * The capture is real SKM output, so its own dates are real and would rot in a
 * fortnight — the card and the sheet would then render nothing and look broken
 * rather than empty. Days are authored as `dayOffset` and stamped here into the
 * `D. M. YYYY` shape `menuDateKey` reads, the same trick `fixtureRebase` plays
 * for exam terms.
 *
 * Pure and separately tested; the seeding side effect lives in `menuSeed.ts`.
 */
export function rebaseMenuFixture(fixture: unknown, now: Date): OutletMenu[] {
  const outlets = (fixture as { outlets?: unknown } | null)?.outlets;
  if (!Array.isArray(outlets)) return [];

  return outlets.map((raw) => {
    const o = (raw ?? {}) as FixtureOutlet;
    const days = Array.isArray(o.days) ? o.days : [];
    return {
      outlet: o.outlet ?? '',
      days: days.map((d) => {
        const when = new Date(now);
        when.setDate(when.getDate() + (typeof d.dayOffset === 'number' ? d.dayOffset : 0));
        return {
          date: `${when.getDate()}. ${when.getMonth() + 1}. ${when.getFullYear()}`,
          soup: d.soup ?? null,
          mainDishes: Array.isArray(d.mainDishes) ? d.mainDishes : [],
        };
      }),
    };
  });
}
