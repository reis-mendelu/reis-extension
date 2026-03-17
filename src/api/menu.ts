import type { DayMenu, OutletMenu } from '../types/menuTypes';
import { fetchViaProxy } from './proxyClient';

const MENU_URL = 'https://skm.mendelu.cz/stravovani/28603-jidelni-listek';

const TARGET_OUTLETS: Record<string, string> = {
  'vydejna-x': 'X',
  'vydejna-ka': 'KA',
  'menza-jak': 'JAK',
};

const TARGET_CATEGORIES = new Set(['Polévka', 'Hlavní jídlo']);

function parseDishName(row: Element): string {
  return row.querySelector('.j-nazev .j-slozeni')?.textContent?.trim() ?? '';
}

function parseOutlet(container: Element): DayMenu[] {
  const days: DayMenu[] = [];
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
      if (!TARGET_CATEGORIES.has(currentCategory)) continue;

      const name = parseDishName(row);
      if (currentCategory === 'Polévka') {
        day.soup = name;
      } else {
        day.mainDishes.push(name);
      }
    }

    days.push(day);
  }

  return days;
}

export async function fetchMenu(): Promise<OutletMenu[]> {
  const html = await fetchViaProxy(MENU_URL);
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const result: OutletMenu[] = [];

  for (const [id, label] of Object.entries(TARGET_OUTLETS)) {
    const container = doc.getElementById(id);
    if (!container) continue;
    result.push({ outlet: label, days: parseOutlet(container) });
  }

  return result;
}
