import type { PendingPayment } from '../../../types/iskam';

const COL_DUE_DATE = 0;
const COL_DESCRIPTION = 1;
const COL_AMOUNT = 2;

export function parsePendingPayments(html: string): PendingPayment[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('#PozadavkyNaUhradyTable');
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const result: PendingPayment[] = [];

    for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        // Skip total/summary rows (first cell spans multiple columns or has bold class)
        if (cells.length < 3) continue;
        if (cells[0].hasAttribute('colspan') || cells[0].classList.contains('bold')) continue;

        const dueDate = cells[COL_DUE_DATE]?.textContent?.trim() ?? '';
        const description = cells[COL_DESCRIPTION]?.textContent?.trim() ?? '';
        const amount = cells[COL_AMOUNT]?.textContent?.trim() ?? '';

        if (description && amount) {
            result.push({ dueDate, description, amount });
        }
    }

    return result;
}
