import type { UbytovaniRow } from '../../../types/iskam';

const TABLE_ID = 'tablePrehledUbytovani';
const ACTIVE_STATUSES = new Set(['Ubytovaný', 'Rezervace', 'Accommodated', 'Reservation']);

export function parseUbytovani(html: string): UbytovaniRow[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.getElementById(TABLE_ID);
    if (!table) return [];

    const tbody = table.querySelector('tbody');
    if (!tbody) return [];

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const out: UbytovaniRow[] = [];

    for (const tr of rows) {
        const tds = Array.from(tr.children).filter(c => c.tagName === 'TD') as HTMLElement[];
        if (tds.length < 6) continue;

        const status = (tds[5].textContent || '').trim();
        if (!ACTIVE_STATUSES.has(status)) continue;

        const dorm = (tds[0].textContent || '').trim();
        const block = (tds[1].textContent || '').trim();
        const room = (tds[2].textContent || '').trim();
        const startDate = (tds[3].textContent || '').trim();
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
