import type { UbytovaniRow } from '../../../types/iskam';

const TABLE_ID = 'tablePrehledUbytovani';
const ACTIVE_STATUSES = new Set([
  'Ubytovaný',
  'Rezervace',
  'Accommodated',
  'Reservation',
  'Booking',
  'Checked in',
]);

export function parseUbytovani(html: string): UbytovaniRow[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.getElementById(TABLE_ID);
  if (!table) return [];

  const tbody = table.querySelector('tbody');
  if (!tbody) return [];

  const rows = Array.from(tbody.querySelectorAll('tr'));
  const out: UbytovaniRow[] = [];

  for (const tr of rows) {
    const tds = Array.from(tr.children).filter((c) => c.tagName === 'TD') as HTMLElement[];
    if (tds.length < 6) continue;

    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const status = (tds[5].textContent || '').trim();
    if (!ACTIVE_STATUSES.has(status)) continue;

    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const dorm = (tds[0].textContent || '').trim();
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const block = (tds[1].textContent || '').trim();
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const room = (tds[2].textContent || '').trim();
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const startDate = (tds[3].textContent || '').trim();
    // @ts-ignore -- nuia: parser load-bearing (see CLAUDE.md Parser Rules)
    const endDate = (tds[4].textContent || '').trim();

    let contractHref: string | null = null;
    if (tds[7]) {
      const link = tds[7].querySelector('a');
      contractHref = link?.getAttribute('href') || null;
    }

    if (!dorm || !startDate || !endDate) continue;

    out.push({ dorm, block, room, startDate, endDate, status, contractHref });
  }
  return out;
}
