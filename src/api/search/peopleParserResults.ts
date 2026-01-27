import { sanitizeString, validateUrl } from '../../utils/validation/index';
import type { Person } from './types';

export function parseMendeluListResults(doc: Document, baseUrl: string): Person[] {
    const personLinks = doc.querySelectorAll("a[href*='clovek.pl?zpet=']");
    return Array.from(personLinks).map(link => {
        const name = link.textContent?.trim() ?? 'Unknown Name';
        const href = link.getAttribute('href') ?? '';
        const idMatch = href.match(/id=(\d+)/);
        const id = idMatch ? idMatch[1] : null;

        const detailsNode = link.nextSibling;
        const rawDetails = detailsNode ? detailsNode.textContent?.trim().replace(/^-/, '').trim() ?? '' : 'No details';

        const statusMatch = rawDetails.match(/\[(.*?)\]$/);
        const status = statusMatch ? statusMatch[1].trim() : 'N/A';
        const primaryInfo = rawDetails.replace(statusMatch ? statusMatch[0] : '', '').trim();
        const parts = primaryInfo.split(/\s+/);
        const faculty = parts[0] ?? 'N/A';
        const programAndMode = parts.slice(1).join(' ');

        const hasStudentIndicators = rawDetails.includes('[') && (
            rawDetails.includes('term') || rawDetails.includes('year') ||
            rawDetails.includes('ročník') || rawDetails.includes('sem')
        );

        const hasStudyProgramIndicators =
            rawDetails.includes(' pres ') || rawDetails.includes(' komb ') ||
            rawDetails.includes('Bachelor') || rawDetails.includes('Master') ||
            rawDetails.includes('Bakalářský typ studia') ||
            rawDetails.includes('Magisterský typ studia') ||
            rawDetails.includes('Doktorský typ studia') ||
            rawDetails.includes('prezenční forma') ||
            rawDetails.includes('kombinovaná forma') ||
            rawDetails.includes('Univerzita třetího věku') ||
            rawDetails.includes('Celoživotní vzdělávání') ||
            rawDetails.includes('U3V');

        const isStudent = hasStudentIndicators || hasStudyProgramIndicators;

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

        let personLink = baseUrl + href;
        if (!personLink.includes('lang=')) personLink += ';lang=cz';

        const sanitizedName = sanitizeString(name, 200);
        const validatedLink = validateUrl(personLink, 'is.mendelu.cz');

        if (!sanitizedName) return null;

        return {
            id,
            name: sanitizedName,
            link: validatedLink || personLink,
            faculty: sanitizeString(faculty, 100),
            programAndMode: sanitizeString(programAndMode, 200),
            status: sanitizeString(status, 100),
            rawDetails: sanitizeString(rawDetails, 500),
            type
        };
    }).filter(p => p !== null) as Person[];
}
