import type { KontaTransaction } from '../../../types/iskam';

function parseCzechNumber(text: string): number | null {
    const cleaned = text.trim().replace(/\s/g, '').replace(',', '.');
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
}

function cellText(td: Element): string {
    return (td.querySelector('label')?.textContent ?? td.textContent ?? '').trim();
}

export function parseKontaTransactions(html: string): KontaTransaction[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('#tablePrevodyUhrady tbody tr'));
    const out: KontaTransaction[] = [];

    for (const row of rows) {
        if (row.classList.contains('pohledavka-poznamka')) continue;

        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 7) continue;

        const datetime = cellText(cells[0]);
        const settledDate = cellText(cells[1]);
        const type = cellText(cells[2]);
        const description = cellText(cells[3]);
        const topUp = parseCzechNumber(cellText(cells[4]));
        const payment = parseCzechNumber(cellText(cells[5]));
        const balanceRaw = parseCzechNumber(cellText(cells[6]));

        if (!datetime || !settledDate || balanceRaw === null) continue;

        out.push({ datetime, settledDate, type, description, topUp, payment, balance: balanceRaw });
    }

    return out;
}
