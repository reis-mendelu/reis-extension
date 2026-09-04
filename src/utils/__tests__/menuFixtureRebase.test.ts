import { describe, it, expect } from 'vitest';
import { rebaseMenuFixture } from '../../../dev/menuFixture';

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
