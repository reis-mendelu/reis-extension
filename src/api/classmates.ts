import { fetchWithAuth, BASE_URL } from './client';
import type { Classmate } from '../types/classmates';

const SPOLUZACI_URL = `${BASE_URL}/auth/student/spoluzaci.pl`;

/**
 * Fetches the classmates overview page and extracts seminar group IDs per subject.
 * Returns a map of courseCode → skupinaId (from "ze cvičení" links).
 */
export async function fetchSeminarGroupIds(
    studium: string,
    obdobi: string
): Promise<Record<string, string>> {
    const url = `${SPOLUZACI_URL}?studium=${studium};obdobi=${obdobi}`;
    const response = await fetchWithAuth(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const table = doc.querySelector('#table_1');
    if (!table) return {};

    const result: Record<string, string> = {};
    const rows = table.querySelectorAll('tr');

    for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        const subjectCell = cells[0];
        const courseCode = subjectCell?.textContent?.trim().split(' ')[0];
        if (!courseCode) continue;

        // Find "ze cvičení" link: has skupina= but NOT vyucujici= or email=
        const links = row.querySelectorAll('a[href*="skupina="]');
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('vyucujici=') || href.includes('email=')) continue;
            const match = href.match(/skupina=(\d+)/);
            if (match) {
                result[courseCode] = match[1];
                break;
            }
        }
    }

    return result;
}

/**
 * Fetches classmates for a specific subject seminar group.
 */
export async function fetchClassmates(
    predmetId: string,
    studium: string,
    obdobi: string,
    skupinaId: string
): Promise<Classmate[]> {
    const url = `${SPOLUZACI_URL}?predmet=${predmetId};studium=${studium};obdobi=${obdobi};skupina=${skupinaId}`;
    const response = await fetchWithAuth(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const table = doc.querySelector('#tmtab_1');
    if (!table) return [];

    const classmates: Classmate[] = [];
    const rows = table.querySelectorAll('tr');

    for (const row of rows) {
        const cells = row.querySelectorAll('td');
        // Cell mapping: [hidden-num, visible-num, photo(2), name(3), studyInfo(4), email-icon]
        if (cells.length < 5) continue;

        const photoImg = cells[2]?.querySelector('img');
        const photoUrl = photoImg?.getAttribute('src') || '';

        const name = cells[3]?.textContent?.trim() || '';
        if (!name) continue;

        const studyInfo = cells[4]?.textContent?.trim() || '';

        // Extract personId from photo URL: /auth/lide/foto.pl?id=<personId>
        let personId = 0;
        const idMatch = photoUrl.match(/[?&;]id=(\d+)/);
        if (idMatch) personId = parseInt(idMatch[1], 10);

        classmates.push({ personId, photoUrl, name, studyInfo });
    }

    return classmates;
}
