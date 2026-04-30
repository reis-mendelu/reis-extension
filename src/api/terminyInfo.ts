import { BASE_URL, fetchWithAuth } from './client';
import type { Classmate } from '../types/classmates';

export async function fetchExamClassmates(
    terminId: string,
    studiumId: string,
    obdobiId: string,
): Promise<Classmate[] | null> {
    try {
        const url = `${BASE_URL}/auth/student/terminy_info.pl?termin=${terminId};spoluzaci=1;studium=${studiumId};obdobi=${obdobiId};lang=cz`;
        const res = await fetchWithAuth(url);

        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const tables = doc.getElementsByTagName('table');

        for (let t = 0; t < tables.length; t++) {
            const rows = tables[t].getElementsByTagName('tr');
            if (rows.length < 2) continue;
            const headerTexts = Array.from(rows[0].getElementsByTagName('th'))
                .map((c: Element) => c.textContent ?? '');
            if (!headerTexts.some(h => h.includes('Jméno'))) continue;

            // Row layout: [UISTMNumberHidden, order, name(link), studyProgram(hidden), date, emailLink]
            const result: Classmate[] = [];
            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].getElementsByTagName('td');
                if (cells.length < 5) continue;

                // Live browser layout (5 cells, no hidden order column):
                // [0] order, [1] name(link), [2] studyInfo, [3] date, [4] emailLink
                const nameLink = cells[1].querySelector<HTMLAnchorElement>('a[href*="clovek.pl"]');
                if (!nameLink) continue;

                const idMatch = nameLink.getAttribute('href')?.match(/id=(\d+)/);
                if (!idMatch) continue;

                const personId = parseInt(idMatch[1], 10);
                const name = nameLink.textContent?.trim() ?? '';
                const studyInfo = cells[2].textContent?.trim() ?? '';
                const msgLink = cells[4]?.querySelector<HTMLAnchorElement>('a[href*="nova_zprava.pl"]');
                const messageUrl = msgLink?.getAttribute('href') ?? undefined;
                const photoUrl = `${BASE_URL}/auth/lide/foto.pl?id=${personId};lang=cz`;

                if (name) result.push({ personId, name, photoUrl, studyInfo, messageUrl });
            }
            return result;
        }
        return null;
    } catch {
        return null;
    }
}
