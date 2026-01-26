export function parseRequirementsTable(doc: Document) {
    const el = Array.from(doc.querySelectorAll("b, span, strong, h1, h2, h3")).find(x => x.textContent?.includes("Rozložení požadavků na ukončení"));
    const row = el?.closest("tr")?.nextElementSibling, table = row?.querySelector("table");
    if (!table) return [];
    return Array.from(table.querySelectorAll("tr")).map(r => Array.from(r.querySelectorAll("th, td")).map(c => (c.textContent || '').trim().replace(/\s+/g, " "))).filter(r => r.length > 0);
}
