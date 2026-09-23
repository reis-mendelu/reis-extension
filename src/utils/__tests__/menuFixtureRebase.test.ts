import { describe, it, expect } from 'vitest';
import { rebaseMenuFixture } from '../../../dev/menuFixture';
import canteenMenu from '../../../dev/fixtures/canteenMenu.json';

const NOW = new Date(2026, 1, 10); // 10 Feb 2026

describe('rebaseMenuFixture', () => {
  // The captured menu is real SKM output, so its dates are real and would rot
  // within a fortnight. `menuDateKey` reads the first "D. M." out of the
  // heading, so that is the shape this has to produce.
  it('materialises each day from its offset into an SKM-shaped heading', () => {
    const out = rebaseMenuFixture(
      {
        outlets: [
          {
            outlet: 'X',
            days: [
              { dayOffset: 0, soup: 'Hrachová', mainDishes: ['Svíčková'] },
              { dayOffset: 3, soup: null, mainDishes: ['Guláš'] },
            ],
          },
        ],
      },
      NOW
    );

    expect(out[0]!.outlet).toBe('X');
    expect(out[0]!.days[0]!.date).toBe('10. 2. 2026');
    expect(out[0]!.days[1]!.date).toBe('13. 2. 2026');
    expect(out[0]!.days[0]!.soup).toBe('Hrachová');
    expect(out[0]!.days[1]!.mainDishes).toEqual(['Guláš']);
  });

  it('gives nothing for a malformed fixture rather than throwing', () => {
    expect(rebaseMenuFixture(null, NOW)).toEqual([]);
    expect(rebaseMenuFixture({}, NOW)).toEqual([]);
    expect(rebaseMenuFixture({ outlets: 'nope' }, NOW)).toEqual([]);
  });
});

/**
 * The committed capture was taken on a Friday, so offsets 1-2 fell on the
 * weekend SKM publishes no menu for and the capture had no rows there. Rebasing
 * pins offset 0 to today whatever weekday that is, so that two-day hole slid
 * onto whichever days happened to follow today — on a Sunday it landed on
 * Monday and Tuesday, and the jídelníček card for those days rendered nothing,
 * which reads as a broken fetch rather than an incomplete fixture.
 */
describe('the committed canteen fixture', () => {
  it('covers every day of the week the calendar can reach, in every outlet', () => {
    const out = rebaseMenuFixture(canteenMenu, NOW);
    expect(out.length).toBeGreaterThan(0);

    for (const outlet of out) {
      const dates = new Set(outlet.days.map((d) => d.date));
      for (let offset = 0; offset <= 7; offset += 1) {
        const when = new Date(NOW);
        when.setDate(when.getDate() + offset);
        const key = `${when.getDate()}. ${when.getMonth() + 1}. ${when.getFullYear()}`;
        expect(dates, `${outlet.outlet} has no menu for offset ${offset} (${key})`).toContain(key);
      }
    }
  });
});
