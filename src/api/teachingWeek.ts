import { fetchWithAuth } from './client';
import { getStudium } from '../utils/userParams';

const PREHLED_URL = 'https://is.mendelu.cz/auth/ca/prehled_tydnu.pl';

export interface TeachingWeek {
    current: number;
    total: number;
}

export function parseTeachingWeek(html: string): TeachingWeek | null {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('#tmtab_1');
    if (!table) return null;

    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) return null;

    let current: number | null = null;
    for (const row of rows) {
        const cells = row.querySelectorAll('td.odsazena');
        const weekCell = cells[0];
        if (!weekCell) continue;
        if (weekCell.querySelector('b')) {
            const match = weekCell.textContent?.match(/(\d+)\./);
            if (match) current = parseInt(match[1], 10);
        }
    }

    if (current === null) return null;
    return { current, total: rows.length };
}

export async function fetchTeachingWeek(): Promise<TeachingWeek | null> {
    const studium = await getStudium();
    if (!studium) return null;

    try {
        const res = await fetchWithAuth(`${PREHLED_URL}?studium=${studium};lang=cz`);
        const html = await res.text();
        return parseTeachingWeek(html);
    } catch {
        return null;
    }
}
