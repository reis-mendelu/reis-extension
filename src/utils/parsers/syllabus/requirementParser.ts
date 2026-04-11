import { findHeaderRow } from './findHeaderRow';

export function parseRequirementsText(doc: Document) {
    const row = findHeaderRow(doc, ["Požadavky na ukončení", "Requirements for completion", "Assessment methods:", "Metody hodnocení:"]);
    const contentRow = row?.nextElementSibling;
    const cell = contentRow?.querySelector("td");
    
    if (!cell) return 'Error: Section not found';
    
    const clone = cell.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
    return (clone.textContent || '').split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(l => l.length > 0).join('\n');
}
