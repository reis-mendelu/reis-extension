import { sanitizeString } from '../../utils/validation/index';
import type { Subject } from './types';

/**
 * Parses subject results from the global search HTML.
 */
export function parseSubjectResults(htmlString: string): Subject[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/";

    const subjects: Subject[] = [];
    const seenIds = new Set<string>();
    const subjectLinks = doc.querySelectorAll('a[href*="katalog/syllabus.pl"]');
    const codePattern = /^([A-Z][A-Z0-9-]*[A-Z0-9])\s+(.+)$/;

    subjectLinks.forEach((link) => {
        const href = link.getAttribute('href') ?? '';
        const fullText = link.textContent?.trim() ?? '';
        const idMatch = href.match(/predmet=(\d+)/);
        const id = idMatch ? idMatch[1] : '';

        if (!id || !fullText) return;
        
        const codeMatch = fullText.match(codePattern);
        if (!codeMatch) return;
        
        const code = codeMatch[1];
        const name = codeMatch[2];
        
        if (seenIds.has(id)) return;
        seenIds.add(id);

        const nextText = link.nextSibling?.textContent ?? '';
        const semesterMatch = nextText.match(/(ZS|LS)\s+\d{4}\/\d{4}/);
        const semester = semesterMatch ? semesterMatch[0] : '';
        const facultyMatch = nextText.match(/- ([A-Z]{2,5})$/);
        const faculty = facultyMatch ? facultyMatch[1] : 'N/A';

        const prevElement = link.previousElementSibling as HTMLElement;
        const colorStyle = prevElement?.getAttribute?.('style') ?? '';
        const colorMatch = colorStyle.match(/background-color:\s*(#[a-fA-F0-9]{6})/);
        const facultyColor = colorMatch ? colorMatch[1] : '#6b7280';

        let subjectLink = href.startsWith('../') ? baseUrl + href.replace('../', '') : baseUrl + href;
        if (!subjectLink.includes('lang=')) subjectLink += ';lang=cz';

        subjects.push({
            id,
            code: sanitizeString(code, 50),
            name: sanitizeString(name, 200),
            link: subjectLink,
            faculty: sanitizeString(faculty, 20),
            facultyColor,
            semester
        });
    });

    return subjects;
}
