import { fetchWithAuth } from './client';
import { getStudium } from '../utils/userParams';

const PREHLED_URL = 'https://is.mendelu.cz/auth/ca/prehled_tydnu.pl';

export interface TeachingWeekEntry {
    week: number;
    from: string; // YYYY-MM-DD
    to: string;   // YYYY-MM-DD
}

export interface TeachingWeekData {
    weeks: TeachingWeekEntry[];
    total: number;
}

function parseDateCz(d: string): string {
    // "16.02.2026" → "2026-02-16"
    const [day, month, year] = d.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function parseTeachingWeeks(html: string): TeachingWeekData | null {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('#tmtab_1');
    if (!table) return null;

    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) return null;

    const weeks: TeachingWeekEntry[] = [];
    for (const row of rows) {
        const cells = row.querySelectorAll('td.odsazena');
        if (cells.length < 3) continue;

        const weekText = (cells[0].textContent || '').trim();
        const fromText = (cells[1].textContent || '').trim();
        const toText = (cells[2].textContent || '').trim();

        const match = weekText.match(/(\d+)\./);
        if (!match) continue;

        weeks.push({
            week: parseInt(match[1], 10),
            from: parseDateCz(fromText),
            to: parseDateCz(toText),
        });
    }

    if (weeks.length === 0) return null;
    return { weeks, total: weeks.length };
}

export function getWeekForDate(data: TeachingWeekData, date: Date): number | null {
    const d = date.toISOString().slice(0, 10);
    for (const entry of data.weeks) {
        if (d >= entry.from && d <= entry.to) return entry.week;
    }
    return null;
}

export async function fetchTeachingWeeks(): Promise<TeachingWeekData | null> {
    const studium = await getStudium();
    if (!studium) return null;

    try {
        const res = await fetchWithAuth(`${PREHLED_URL}?studium=${studium};lang=cz`);
        const html = await res.text();
        return parseTeachingWeeks(html);
    } catch {
        return null;
    }
}
