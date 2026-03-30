import { fetchWithAuth, BASE_URL } from './client';
import type { Classmate } from '../types/classmates';

const SPOLUZACI_URL = `${BASE_URL}/auth/student/spoluzaci.pl`;

/**
 * Parse one page of the #tmtab_1 classmates table.
 *
 * Mirrors the battle-tested logic from reis-scraper/scripts/debug-classmates.ts:
 *  - Find rows with a non-empty clovek.pl link to get personId + name
 *  - Photo from img[src*="foto.pl"]
 *  - Message URL from a[href*="nova_zprava.pl"]
 *  - Study info from a td whose text looks like a study programme label
 */
function parseClassmatesPage(doc: Document): Classmate[] {
    const table = doc.querySelector('#tmtab_1');
    if (!table) return [];

    const results: Classmate[] = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach((row, i) => {
        if (i === 0) return; // skip header

        // Each row has two clovek.pl links: [0] wraps the photo (empty text), [1] is the name
        const profileLinks = Array.from(
            row.querySelectorAll<HTMLAnchorElement>('a[href*="clovek.pl"]')
        );
        const nameLink = profileLinks.find(a => (a.textContent?.trim() ?? '').length > 0) ?? null;
        if (!nameLink) return;

        const idMatch = nameLink.getAttribute('href')?.match(/id=(\d+)/);
        if (!idMatch) return;

        const personId = parseInt(idMatch[1], 10);
        const name = nameLink.textContent!.trim();

        const photoUrl = `${BASE_URL}/auth/lide/foto.pl?id=${personId};lang=cz`;

        const msgLink = row.querySelector<HTMLAnchorElement>('a[href*="nova_zprava.pl"]');
        const messageUrl = msgLink?.getAttribute('href') ?? undefined;

        // Study info: find a td whose text matches a study programme pattern
        // e.g. "PEF B-OI-ZBOI prez [sem 2, roč 1]"
        const studyInfo = Array.from(row.querySelectorAll('td'))
            .map(td => td.textContent?.trim() ?? '')
            .find(t => /[A-Z]{2,}.*(?:prez|komb|\[sem|\[roč|B-|N-|D-)/.test(t)) ?? '';

        results.push({ personId, name, photoUrl, studyInfo, messageUrl });
    });

    return results;
}

/**
 * Fetch the spoluzaci overview page and extract seminar group IDs per predmetId.
 *
 * Mirrors the scraper's group-discovery phase:
 *   /auth/student/spoluzaci.pl?studium=X;obdobi=Y;lang=cz
 *
 * Returns a map of predmetId → skupinaId.
 * The caller (syncService) matches predmetId to courseCode via subjects store
 * (subject.subjectId === predmetId).
 */
export async function fetchSeminarGroupIds(
    studiumId: string,
    obdobi: string,
): Promise<Record<string, string>> {
    const url = `${SPOLUZACI_URL}?studium=${studiumId};obdobi=${obdobi};lang=cz`;
    const response = await fetchWithAuth(url);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const result: Record<string, string> = {};

    // Links look like: spoluzaci.pl?predmet=162570;;studium=...;skupina=178894;lang=cz
    // We only want links that have both predmet= and skupina= (seminar group links).
    const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="skupina="]'));

    for (const link of links) {
        const href = link.getAttribute('href') ?? '';
        // Skip teacher and email views
        if (href.includes('vyucujici=') || href.includes('email=')) continue;

        const skupinaMatch = href.match(/skupina=(\d+)/);
        const predmetMatch = href.match(/predmet=(\d+)/);
        if (!skupinaMatch || !predmetMatch) continue;

        const predmetId = predmetMatch[1];
        const skupinaId = skupinaMatch[1];

        // Only keep the first skupina found per predmet (the student's seminar group)
        if (!result[predmetId]) {
            result[predmetId] = skupinaId;
        }
    }

    return result;
}

/**
 * Fetch all classmates for a given seminar group, following pagination.
 *
 * URL shape exactly mirrors the IS scraper:
 *   /auth/student/spoluzaci.pl?predmet=X;;studium=Y;obdobi=Z;skupina=W;lang=cz
 *
 * The double ;; after predmet is intentional — it matches what IS generates
 * in its own anchor hrefs and is required for legacy compatibility.
 *
 * Pagination links (e.g. "41–80") are resolved and fetched sequentially.
 */
export async function fetchClassmates(
    predmetId: string,
    studiumId: string,
    obdobi: string,
    skupinaId: string,
): Promise<Classmate[]> {
    const firstUrl = `${SPOLUZACI_URL}?predmet=${predmetId};;studium=${studiumId};obdobi=${obdobi};skupina=${skupinaId};lang=cz`;

    const response = await fetchWithAuth(firstUrl);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Collect pagination hrefs whose link text is "41–80" style
    const paginationLinks: string[] = Array.from(
        doc.querySelectorAll<HTMLAnchorElement>('a[href*="spoluzaci.pl"]')
    )
        .filter(a => /^\d+–\d+$/.test(a.textContent?.trim() ?? ''))
        .map(a => {
            const href = a.getAttribute('href') ?? '';
            return href.startsWith('http') ? href : `${BASE_URL}${href}`;
        });

    const all: Classmate[] = parseClassmatesPage(doc);

    for (const link of paginationLinks) {
        const r = await fetchWithAuth(link);
        const h = await r.text();
        const d = new DOMParser().parseFromString(h, 'text/html');
        all.push(...parseClassmatesPage(d));
    }

    return all;
}
