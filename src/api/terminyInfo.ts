import { BASE_URL, fetchWithAuth } from './client';
import { logError } from '../utils/reportError';
import type { Classmate } from '../types/classmates';

/**
 * Parse one exam-classmates page.
 *
 * Row layout (live, 5 cells): [order, name(link), studyInfo, date, emailLink].
 * The historical scraper saw 6 cells because of a hidden UISTMNumber column —
 * we rely on the name<->clovek.pl link to anchor parsing rather than column
 * indices, so the parser tolerates either shape.
 *
 * Guard: if a Jméno-headed table is found with content rows but zero
 * classmates parse, report once via telemetry so DOM drift surfaces in
 * data instead of intuition. Per CLAUDE.md parser rules we do NOT relax
 * the parser — we report and return [].
 */
export function parseExamClassmatesPage(doc: Document): Classmate[] {
    const tables = doc.getElementsByTagName('table');

    for (let t = 0; t < tables.length; t++) {
        const rows = tables[t].getElementsByTagName('tr');
        if (rows.length < 2) continue;
        const headerTexts = Array.from(rows[0].getElementsByTagName('th'))
            .map((c: Element) => c.textContent ?? '');
        if (!headerTexts.some(h => h.includes('Jméno'))) continue;

        const result: Classmate[] = [];
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length < 5) continue;

            // Anchor on the clovek.pl link in any cell — tolerates both 5-cell
            // (live) and 6-cell (scraper) layouts without column-index drift.
            const nameLink = rows[i].querySelector<HTMLAnchorElement>('a[href*="clovek.pl"]');
            if (!nameLink) continue;

            const idMatch = nameLink.getAttribute('href')?.match(/id=(\d+)/);
            if (!idMatch) continue;

            const personId = parseInt(idMatch[1], 10);
            const name = nameLink.textContent?.trim() ?? '';
            if (!name) continue;

            // studyInfo is the cell directly after the name's parent cell.
            const nameCell = nameLink.closest('td');
            const studyCell = nameCell?.nextElementSibling as HTMLElement | null;
            const studyInfo = studyCell?.textContent?.trim() ?? '';

            const msgLink = rows[i].querySelector<HTMLAnchorElement>('a[href*="nova_zprava.pl"]');
            const messageUrl = msgLink?.getAttribute('href') ?? undefined;
            const photoUrl = `${BASE_URL}/auth/lide/foto.pl?id=${personId};lang=cz`;

            result.push({ personId, name, photoUrl, studyInfo, messageUrl });
        }

        if (result.length === 0 && rows.length > 1) {
            const hasContent = Array.from(rows).slice(1).some(
                r => (r.textContent?.trim().length ?? 0) > 0,
            );
            if (hasContent) {
                logError(
                    'Parser.parseExamClassmatesPage',
                    new Error('exam spoluzaci table has rows but zero parsed'),
                    { rowCount: rows.length },
                );
            }
        }
        return result;
    }
    return [];
}

export async function fetchExamClassmates(
    terminId: string,
    studiumId: string,
    obdobiId: string,
): Promise<Classmate[]> {
    const url = `${BASE_URL}/auth/student/terminy_info.pl?termin=${terminId};spoluzaci=1;studium=${studiumId};obdobi=${obdobiId};lang=cz`;
    try {
        const res = await fetchWithAuth(url);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        return parseExamClassmatesPage(doc);
    } catch (e) {
        logError('Api.fetchExamClassmates', e, { terminId });
        throw e;
    }
}
