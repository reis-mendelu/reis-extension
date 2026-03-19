import type { DayMenu, OutletMenu } from '../types/menuTypes';
import type { Language } from '../store/types';
import { fetchViaProxy } from './proxyClient';

const LANG_CONFIG: Record<Language, {
  url: string;
  outlets: Record<string, string>;
  soupCategory: string;
  mainCategory: string;
}> = {
  cz: {
    url: 'https://skm.mendelu.cz/stravovani/28603-jidelni-listek',
    outlets: { 'vydejna-x': 'X', 'vydejna-ka': 'KA', 'menza-jak': 'JAK' },
    soupCategory: 'Polévka',
    mainCategory: 'Hlavní jídlo',
  },
  en: {
    url: 'https://skm.mendelu.cz/en/catering/28604-menu',
    outlets: { 'vydejna-x': 'X', 'vydejna-ka': 'KA', 'canteen-jak': 'JAK' },
    soupCategory: 'Soup',
    mainCategory: 'Main dish',
  },
};

function parseDishName(row: Element): string {
  return (
    row.querySelector('.j-nazev .j-slozeni')?.textContent?.trim()
    ?? row.querySelector('.j-nazev span')?.textContent?.trim()
    ?? ''
  );
}

function parseOutlet(container: Element, config: typeof LANG_CONFIG[Language]): DayMenu[] {
  const days: DayMenu[] = [];
  const targetCategories = new Set([config.soupCategory, config.mainCategory]);
  const h3s = container.querySelectorAll('h3');

  for (const h3 of h3s) {
    const date = h3.textContent?.trim() ?? '';
    const table = h3.nextElementSibling;
    if (!table || !table.classList.contains('jidelnicek')) continue;

    let currentCategory = '';
    const day: DayMenu = { date, soup: null, mainDishes: [] };

    const rows = table.querySelectorAll('tr');
    for (const row of rows) {
      const catCell = row.querySelector('.j-kategorie');
      if (catCell) {
        currentCategory = catCell.textContent?.trim() ?? '';
        continue;
      }

      if (!row.classList.contains('jidlo')) continue;
      if (!targetCategories.has(currentCategory)) continue;

      const name = parseDishName(row);
      if (currentCategory === config.soupCategory) {
        day.soup = name;
      } else {
        day.mainDishes.push(name);
      }
    }

    days.push(day);
  }

  return days;
}

export async function fetchMenu(lang: Language): Promise<OutletMenu[]> {
  const config = LANG_CONFIG[lang];
  const html = await fetchViaProxy(config.url);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const result: OutletMenu[] = [];

  for (const [id, label] of Object.entries(config.outlets)) {
    const container = doc.getElementById(id);
    if (!container) continue;
    result.push({ outlet: label, days: parseOutlet(container, config) });
  }

  return result;
}
