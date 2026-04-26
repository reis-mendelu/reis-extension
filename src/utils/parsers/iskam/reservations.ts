import type { IskamReservation } from '../../../types/iskam';

export function parseReservations(html: string): IskamReservation[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('#tablePrehledRezervaci');
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const reservations: IskamReservation[] = [];

    for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
        if (cells.length < 5) continue;

        // Structure: Dormitory, Block, Room, Start date, End, Price
        reservations.push({
            facility: `${cells[0]} ${cells[1]}`.trim(),
            room: cells[2],
            startDate: cells[3],
            endDate: cells[4],
            price: cells[5] || undefined,
        });
    }

    return reservations;
}
