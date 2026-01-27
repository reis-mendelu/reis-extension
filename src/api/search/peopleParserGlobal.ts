import { sanitizeString } from '../../utils/validation/index';
import type { Person } from './types';

export function parseGlobalPeopleResults(htmlString: string): Person[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/lide/";

    const personLinks = doc.querySelectorAll('a[href*="lide/clovek.pl"]');
    if (personLinks.length === 0) return [];

    const seen = new Set<string>();
    return Array.from(personLinks).map(link => {
        const name = link.textContent?.trim() ?? 'Unknown Name';
        const href = link.getAttribute('href') ?? '';
        const idMatch = href.match(/id=(\d+)/);
        const id = idMatch ? idMatch[1] : null;

        if (!id || seen.has(id)) return null;
        seen.add(id);

        const detailsNode = link.nextSibling;
        const rawDetails = detailsNode ? detailsNode.textContent?.trim().replace(/^-/, '').trim() ?? '' : 'No details';

        const statusMatch = rawDetails.match(/\[(.*?)\]$/);
        const status = statusMatch ? statusMatch[1].trim() : 'N/A';
        const primaryInfo = rawDetails.replace(statusMatch ? statusMatch[0] : '', '').trim();
        const parts = primaryInfo.split(/\s+/);
        const faculty = parts[0] ?? 'N/A';
        const programAndMode = parts.slice(1).join(' ');

        const isStudent = rawDetails.includes('[') && (rawDetails.includes('term') || rawDetails.includes('year') || rawDetails.includes('ročník')) ||
                         rawDetails.includes(' pres ') || rawDetails.includes(' komb ') ||
                         rawDetails.includes('Bachelor') || rawDetails.includes('Master');

        let type: 'student' | 'teacher' | 'staff' = 'staff';
        if (isStudent) {
            type = 'student';
        } else if (
            name.toLowerCase().includes('ph.d.') || name.toLowerCase().includes('csc.') ||
            name.toLowerCase().includes('drsc.') || name.toLowerCase().includes('dr.') ||
            name.toLowerCase().includes('doc.') || name.toLowerCase().includes('prof.') ||
            name.toLowerCase().includes('th.d.')
        ) {
            type = 'teacher';
        }

        let personLink = href.startsWith('../') ? baseUrl + href.replace('../lide/', '') : baseUrl + href.replace('/auth/lide/', '');
        if (!personLink.includes('lang=')) personLink += ';lang=cz';

        const sanitizedName = sanitizeString(name, 200);
        if (!sanitizedName) return null;

        return {
            id,
            name: sanitizedName,
            link: personLink,
            faculty: sanitizeString(faculty, 100),
            programAndMode: sanitizeString(programAndMode, 200),
            status: sanitizeString(status, 100),
            rawDetails: sanitizeString(rawDetails, 500),
            type
        };
    }).filter(p => p !== null) as Person[];
}
