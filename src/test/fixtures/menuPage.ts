import type { MenuPage, OutletMenu, PizzeriaMenu } from '../../types/menuTypes';

/** What `fetchMenu` answers: the canteens, plus the pizzeria when the page has one. */
export const page = (outlets: OutletMenu[], pizzeria: PizzeriaMenu | null = null): MenuPage => ({
  outlets,
  pizzeria,
});

/** A short pizzeria in SKM's own words (api/__tests__/fixtures has the real page). */
export const PIZZERIA: PizzeriaMenu = {
  address: 'Zemědělská 1, Brno',
  hours: [
    'Po-Čt 8:00 - 15:00 výdej pizzy 10:30 - 14:30',
    'Pá 8:00 - 13:00 výdej pizzy 10:30 - 13:00',
  ],
  pizzas: [
    { name: '01. Pizza pollo', price: 86 },
    { name: '02. Pizza americana', price: 80 },
    { name: '14. BZL pollo', price: 99 },
  ],
};
