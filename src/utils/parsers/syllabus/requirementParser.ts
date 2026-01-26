export function parseRequirementsText(doc: Document) {
    const el = Array.from(doc.querySelectorAll("b, span, strong, h1, h2, h3")).find(x => x.textContent?.includes("Požadavky na ukončení"));
    const row = el?.closest("tr")?.nextElementSibling, cell = row?.querySelector("td");
    if (!cell) return 'Error: Section not found';
    const clone = cell.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
    return (clone.textContent || '').split('\n').map(l => l.trim().replace(/\s+/g, ' ')).filter(l => l.length > 0).join('\n');
}
