import { findHeaderRow } from './findHeaderRow';

export function parseRequirementsTable(doc: Document) {
    const row = findHeaderRow(doc, ["Rozložení požadavků na ukončení", "Assessment criteria ratio", "Podíl kritérií na hodnocení"]);
    const table = row?.nextElementSibling?.querySelector("table");
    if (!table) return [];
    return Array.from(table.querySelectorAll("tr")).map(r => Array.from(r.querySelectorAll("th, td")).map(c => (c.textContent || '').trim().replace(/\s+/g, " "))).filter(r => r.length > 0);
}
