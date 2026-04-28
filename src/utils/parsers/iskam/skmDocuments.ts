import type { SkmDocument } from '../../../types/iskam';

export function parseSkmDocuments(html: string): SkmDocument[] {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('a.pdf.uis-ds'))
        .map(a => ({
            label: a.textContent?.trim() ?? '',
            href: a.getAttribute('href') ?? '',
        }))
        .filter(d => d.label && d.href);
}
