import { fetchWithAuth, BASE_URL } from "./client";

const PAST_SUBJECTS_TREE_URL = `${BASE_URL}/auth/dok_server/strom_od.pl?id=6`;

export interface PastSubjectFolder {
    subjectCode: string;
    displayName: string;
    folderUrl: string;
}

export async function fetchPastSubjectFolders(lang: string = 'cz'): Promise<Record<string, PastSubjectFolder>> {
    try {
        const url = `${PAST_SUBJECTS_TREE_URL};lang=${lang}`;
        const response = await fetchWithAuth(url);
        const html = await response.text();
        return parsePastSubjectTree(html);
    } catch (e) {
        console.warn('[pastSubjects] fetchPastSubjectFolders failed:', e);
        return {};
    }
}

export async function fetchDualLanguagePastSubjects(): Promise<{ cz: Record<string, PastSubjectFolder>; en: Record<string, PastSubjectFolder> }> {
    const [cz, en] = await Promise.all([
        fetchPastSubjectFolders('cz'),
        fetchPastSubjectFolders('en'),
    ]);
    return { cz, en };
}

export function parsePastSubjectTree(htmlString: string): Record<string, PastSubjectFolder> {
    const result: Record<string, PastSubjectFolder> = {};
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');

    const links = doc.querySelectorAll('a[href*="slozka.pl"]');
    for (const link of links) {
        const anchor = link as HTMLAnchorElement;
        const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.includes(' / ')) continue;

        const match = text.match(/^([A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+)\s+(.+)$/);
        if (!match) continue;

        const [, subjectCode, displayName] = match;
        if (result[subjectCode]) continue;

        const href = anchor.getAttribute('href') || '';
        const idMatch = href.match(/[?&;]id=(\d+)/);
        if (!idMatch) continue;

        const folderUrl = `${BASE_URL}/auth/dok_server/slozka.pl?id=${idMatch[1]}`;
        result[subjectCode] = { subjectCode, displayName, folderUrl };
    }
    return result;
}
