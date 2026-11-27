import type { OutletDayMenu } from './menuForDay';
import type { SocietyPin, Venue } from '../types/campusMap';
import type { PizzeriaMenu } from '../types/menuTypes';
import { venueOpensOn } from './venues/venueStatus';

/** The tab's label and key. Short, because four tabs share a 320px row. */
export const SKLUB_TAB = 'S-klub';
/** The pizzeria's tab: the same word in Czech and English. */
export const PIZZA_TAB = 'Pizza';
/** S-klub Pixie's pin: `venue:` + its `venues.id` (api/venues.ts). */
export const SKLUB_PIN_ID = 'venue:sklub';

export type MenuTab =
  | { kind: 'outlet'; key: string; menu: OutletDayMenu }
  | { kind: 'venue'; key: string; pin: SocietyPin; venue: Venue }
  | { kind: 'pizzeria'; key: string; pizzeria: PizzeriaMenu };

/**
 * The order of the Jídelníček's tabs, fixed in reIS rather than SKM's page
 * order — Dominik, 1 November 2026. Everyone sees X, JAK, KA, then S-klub
 * (every student gets the S-klub tab since 11 November 2026). An FRRMS student
 * sees their own building first: KA (budova Z's výdejna), S-klub (the café in
 * budova Z), then X and JAK. The pizzeria is last for everyone.
 */
const EVERYONE = ['X', 'JAK', 'KA', SKLUB_TAB];
const FRRMS = ['KA', SKLUB_TAB, 'X', 'JAK'];

/**
 * The tabs for one day: the canteens serving it, plus S-klub when the café is
 * in `venuePins` and opens that day, plus the pizzeria on a day any canteen
 * serves (it has no days of its own). A canteen not serving drops out and the
 * rest keep their order; one reIS does not know yet goes last. `faculty` is
 * the store's `userFaculty` — null until IS answers, which counts as everyone.
 */
export function menuTabs(
  outlets: OutletDayMenu[],
  {
    faculty,
    venuePins,
    dayIso,
    pizzeria = null,
  }: {
    faculty: string | null;
    venuePins: SocietyPin[];
    dayIso: string;
    pizzeria?: PizzeriaMenu | null;
  }
): MenuTab[] {
  const frrms = faculty?.trim().toUpperCase() === 'FRRMS';
  const order = frrms ? FRRMS : EVERYONE;
  const tabs: MenuTab[] = outlets.map((menu) => ({ kind: 'outlet', key: menu.outlet, menu }));
  const pin = venuePins.find((p) => p.id === SKLUB_PIN_ID);
  if (pin?.venue && venueOpensOn(pin.venue, dayIso)) {
    tabs.push({ kind: 'venue', key: SKLUB_TAB, pin, venue: pin.venue });
  }
  if (pizzeria && outlets.length > 0) tabs.push({ kind: 'pizzeria', key: PIZZA_TAB, pizzeria });
  const rank = (key: string) => {
    // Pizza is last of all, after a canteen reIS does not know yet.
    if (key === PIZZA_TAB) return order.length + 1;
    const i = order.indexOf(key);
    return i < 0 ? order.length : i;
  };
  // Array.prototype.sort is stable, so unknown canteens keep SKM's order.
  return tabs.sort((a, b) => rank(a.key) - rank(b.key));
}
