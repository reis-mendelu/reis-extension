import { fetchWithAuth, BASE_URL } from './client';
import type { Classmate } from '../types/classmates';

const SPOLUZACI_URL = `${BASE_URL}/auth/student/spoluzaci.pl`;
const PAGE_SIZE = 40;

export interface SubjectGroupInfo {
    subjectId: string;
    skupinaId?: string;
}

/**
 * Fetches the classmates overview page and extracts subject IDs and seminar group IDs.
 * Returns a map of courseCode → { subjectId, skupinaId? }.
 */
export async function fetchSeminarGroupIds(
    studium: string,
    obdobi: string
): Promise<Record<string, SubjectGroupInfo>> {
    const url = `${SPOLUZACI_URL}?studium=${studium};obdobi=${obdobi}`;
    const response = await fetchWithAuth(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const table = doc.querySelector('#table_1');
    if (!table) return {};

    const result: Record<string, SubjectGroupInfo> = {};
    const rows = table.querySelectorAll('tr');

    for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) continue;

        const subjectCell = cells[0];
        const courseCode = subjectCell?.textContent?.trim().split(' ')[0];
        if (!courseCode) continue;

        // Extract subjectId from any link with predmet= parameter
        const anyLink = row.querySelector('a[href*="predmet="]');
        const predmetMatch = anyLink?.getAttribute('href')?.match(/predmet=(\d+)/);
        if (!predmetMatch) continue;

        const info: SubjectGroupInfo = { subjectId: predmetMatch[1] };

        // Find "ze cvičení" link: has skupina= but NOT vyucujici= or email=
        const links = row.querySelectorAll('a[href*="skupina="]');
        for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('vyucujici=') || href.includes('email=')) continue;
            const match = href.match(/skupina=(\d+)/);
            if (match) {
                info.skupinaId = match[1];
                break;
            }
        }

        result[courseCode] = info;
    }

    return result;
}

/**
 * Fetches classmates for a specific subject, with pagination support.
 * When skupinaId is omitted, fetches the "všichni" (all) view.
 */
export async function fetchClassmates(
    predmetId: string,
    studium: string,
    obdobi: string,
    skupinaId?: string
): Promise<Classmate[]> {
    const allClassmates: Classmate[] = [];
    let page = 0;

    while (true) {
        let url = `${SPOLUZACI_URL}?predmet=${predmetId};studium=${studium};obdobi=${obdobi}`;
        if (skupinaId) url += `;skupina=${skupinaId}`;
        if (page > 0) url += `;on=${page}`;

        const response = await fetchWithAuth(url);
        const html = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const table = doc.querySelector('#tmtab_1');
        console.log(`[fetchClassmates] predmet=${predmetId} page=${page} table=${table ? 'found' : 'NOT FOUND'}`);
        if (!table) break;

        const rows = table.querySelectorAll('tr');
        console.log(`[fetchClassmates] predmet=${predmetId} rows=${rows.length}`);
        let rowCount = 0;

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) continue;

            // Find the photo cell (contains an img tag)
            let photoIdx = -1;
            for (let i = 0; i < cells.length; i++) {
                if (cells[i]?.querySelector('img')) {
                    photoIdx = i;
                    break;
                }
            }
            if (photoIdx === -1) continue;

            // Photo column identified, name is next column, study info is the one after
            const nameIdx = photoIdx + 1;
            const studyInfoIdx = photoIdx + 2;

            if (nameIdx >= cells.length || studyInfoIdx >= cells.length) continue;

            const photoImg = cells[photoIdx]?.querySelector('img');
            const photoUrl = photoImg?.getAttribute('src') || '';
            const name = cells[nameIdx]?.textContent?.trim() || '';
            
            if (rowCount === 0) console.log(`[fetchClassmates] first row sample: cells=${cells.length} photoIdx=${photoIdx} name="${name}"`);
            if (!name) continue;

            const studyInfo = cells[studyInfoIdx]?.textContent?.trim() || '';

            let personId = 0;
            const idMatch = photoUrl.match(/[?\&;]id=(\d+)/);
            if (idMatch) personId = parseInt(idMatch[1], 10);

            // Extract message URL from remaining cells after studyInfo
            let messageUrl: string | undefined;
            for (let i = studyInfoIdx + 1; i < cells.length; i++) {
                const msgLink = cells[i]?.querySelector('a[href*="posta/nova_zprava"]');
                if (msgLink) {
                    messageUrl = msgLink.getAttribute('href') || undefined;
                    break;
                }
            }

            allClassmates.push({ personId, photoUrl, name, studyInfo, messageUrl });
            rowCount++;
        }

        console.log(`[fetchClassmates] predmet=${predmetId} page=${page} parsed=${rowCount}`);
        // If fewer rows than page size, we've reached the last page
        if (rowCount < PAGE_SIZE) break;
        page++;
    }

    console.log(`[fetchClassmates] predmet=${predmetId} total=${allClassmates.length}`);
    return allClassmates;
}
