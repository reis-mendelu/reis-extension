import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePizzeria } from '../menuPizzeria';

/**
 * The "Pizzerie" tab of SKM's jídelní lístek, a real capture (2026-11-25) of
 * `<div id="pizzerie">` in both languages. Public menu, no people. The tab has
 * no dates: it is the standing offer, so the parser returns one menu, not days.
 */
const page = (lang: 'cz' | 'en') =>
  new DOMParser().parseFromString(
    `<html><body>${readFileSync(resolve(__dirname, `fixtures/skm-pizzerie.${lang}.html`), 'utf8')}</body></html>`,
    'text/html'
  );

describe('parsePizzeria — the Czech page', () => {
  const pizzeria = parsePizzeria(page('cz'))!;

  it('reads the address', () => {
    expect(pizzeria.address).toBe('Zemědělská 1, Brno');
  });

  it('keeps the opening hours as SKM words them, one line per row', () => {
    expect(pizzeria.hours).toEqual([
      'Po-Čt 8:00 - 15:00 výdej pizzy 10:30 - 14:30',
      'Pá 8:00 - 13:00 výdej pizzy 10:30 - 13:00',
    ]);
  });

  it('lists every pizza with the STUDENT price (the "St." column)', () => {
    expect(pizzeria.pizzas).toHaveLength(24);
    expect(pizzeria.pizzas[0]).toEqual({ name: '01. PIZZA POLLO', price: 86 });
    expect(pizzeria.pizzas[1]).toEqual({ name: '02. PIZZA AMERICANA', price: 80 });
    expect(pizzeria.pizzas.at(-1)).toEqual({ name: '25. BZL ŠUNKOVÁ', price: 92 });
  });

  it('drops the allergen numbers and collapses the double spaces', () => {
    for (const p of pizzeria.pizzas) {
      expect(p.name).not.toMatch(/\(\d/);
      expect(p.name).not.toMatch(/\s{2,}/);
    }
  });
});

describe('parsePizzeria — the English page', () => {
  const pizzeria = parsePizzeria(page('en'))!;

  it('keeps the heading label out of the hours', () => {
    expect(pizzeria.hours).toEqual([
      'Mon-Thu 11:00 to 14:30',
      'Friday 11:00 to 13:00',
      'Saturday closed',
    ]);
  });

  it('finds the student price by its header, whatever the language', () => {
    expect(pizzeria.pizzas[0]).toEqual({ name: '14. BZL POLLO', price: 99 });
    expect(pizzeria.pizzas.find((p) => p.name === 'PIZZA POLLO')?.price).toBe(86);
  });
});

describe('parsePizzeria — a page without the tab', () => {
  it('is no pizzeria rather than an empty one', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><div id="vydejna-x"></div></body></html>',
      'text/html'
    );
    expect(parsePizzeria(doc)).toBeNull();
  });

  it('is no pizzeria when the tab lists no pizza', () => {
    const doc = new DOMParser().parseFromString(
      '<div id="pizzerie"><table class="jidelnicek"></table></div>',
      'text/html'
    );
    expect(parsePizzeria(doc)).toBeNull();
  });
});
