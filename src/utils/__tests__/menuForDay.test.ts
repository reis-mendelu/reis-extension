import { describe, it, expect } from 'vitest';
import { menuForDay, menuDateKey } from '../menuForDay';
import type { OutletMenu } from '../../types/menuTypes';

const MENU: OutletMenu[] = [
  {
    outlet: 'X',
    days: [
      { date: 'Pondělí 8. 9. 2026', soup: 'Kuřecí vývar', mainDishes: ['Svíčková', 'Rizoto'] },
      { date: 'Úterý 9. 9. 2026', soup: null, mainDishes: [] },
    ],
  },
  {
    outlet: 'KA',
    days: [{ date: 'Pondělí 8. 9. 2026', soup: null, mainDishes: ['Guláš'] }],
  },
  {
    outlet: 'JAK',
    days: [{ date: 'Úterý 9. 9. 2026', soup: 'Česnečka', mainDishes: [] }],
  },
];

describe('menuDateKey', () => {
  // The key the SKM page's own headings produce: the first "D. M." in the
  // string, whatever precedes it. Shared with the desktop header, which built
  // this inline and is the only reason the phone could not reuse it.
  it('reads the day and month out of an SKM heading', () => {
    expect(menuDateKey('Pondělí 8. 9. 2026')).toBe('8.9');
    expect(menuDateKey('1.12.2026')).toBe('1.12');
    expect(menuDateKey('Monday 8. 9. 2026')).toBe('8.9');
  });

  it('gives nothing for a heading with no date in it', () => {
    expect(menuDateKey('Jídelní lístek')).toBe('');
    expect(menuDateKey('')).toBe('');
  });

  it('keys a Date the same way, so the two can be compared', () => {
    expect(menuDateKey(new Date(2026, 8, 8))).toBe('8.9');
    expect(menuDateKey(new Date(2026, 11, 1))).toBe('1.12');
  });
});

describe('menuForDay', () => {
  it('returns every outlet serving that day, in menu order', () => {
    const out = menuForDay(MENU, new Date(2026, 8, 8));
    expect(out.map((o) => o.outlet)).toEqual(['X', 'KA']);
    expect(out[0]).toEqual({
      outlet: 'X',
      soup: 'Kuřecí vývar',
      mainDishes: ['Svíčková', 'Rizoto'],
    });
    expect(out[1]).toEqual({ outlet: 'KA', soup: null, mainDishes: ['Guláš'] });
  });

  // An outlet with a heading for the day but nothing under it is closed, not
  // serving an empty menu — the desktop popover drops it and so does the card,
  // otherwise a weekend or a holiday renders three empty tabs.
  it('drops an outlet whose day has neither soup nor a main dish', () => {
    const out = menuForDay(MENU, new Date(2026, 8, 9));
    expect(out.map((o) => o.outlet)).toEqual(['JAK']);
  });

  it('is empty for a day nothing serves, and for no menu at all', () => {
    expect(menuForDay(MENU, new Date(2026, 8, 12))).toEqual([]);
    expect(menuForDay(null, new Date(2026, 8, 8))).toEqual([]);
    expect(menuForDay([], new Date(2026, 8, 8))).toEqual([]);
  });

  // Same day-of-month in a different month must not match — the SKM page
  // carries two weeks, so 8.9 and 8.10 can both be present.
  it('does not match a different month', () => {
    expect(menuForDay(MENU, new Date(2026, 9, 8))).toEqual([]);
  });
});
