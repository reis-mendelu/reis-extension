import { sanitizeString, validateUrl } from '../../utils/validation';
import type { Person } from './types';

export function parseMendeluProfileResult(doc: Document, baseUrl: string): Person[] {
    const nameElement = doc.querySelector('td.odsazena b font[size="+1"]');
    if (!nameElement) return [];

    const name = nameElement.textContent?.trim() ?? 'Unknown Name';
    let id: string | null = null;
    const allTds = doc.querySelectorAll('td.odsazena');

    allTds.forEach(td => {
        const text = td.textContent ?? '';
        if (text.includes('Identification number:')) {
            const idMatch = text.match(/Identification number:\s*(\d+)/);
            if (idMatch) id = idMatch[1];
        }
    });

    const infoLines: string[] = [];
    const departmentLinks = doc.querySelectorAll("a[href*='pracoviste.pl']");
    departmentLinks.forEach(link => {
        infoLines.push(link.parentElement?.textContent?.trim() ?? '');
    });

    allTds.forEach(td => {
        const text = td.textContent ?? '';
        if (text.includes(' pres ') || text.includes(' komb ') ||
            text.includes('[term') || text.includes('[year') ||
            text.includes('Bachelor') || text.includes('Master')) {
            infoLines.push(text.trim());
        }
    });

    const rawDetails = infoLines.join('\n');
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

    let personLink = id ? `${baseUrl}clovek.pl?id=${id}` : '';
    if (personLink && !personLink.includes('lang=')) personLink += ';lang=cz';

    const sanitizedName = sanitizeString(name, 200);
    const validatedLink = validateUrl(personLink, 'is.mendelu.cz');

    if (!sanitizedName) return [];

    return [{
        id: id,
        name: sanitizedName,
        link: validatedLink || personLink,
        faculty: sanitizeString(infoLines.length > 0 ? infoLines[0] : 'N/A', 100),
        programAndMode: isStudent ? 'Student Profile' : 'Staff Profile',
        status: isStudent ? 'Student' : 'Staff',
        rawDetails: sanitizeString(rawDetails, 500),
        type: type
    }];
}
