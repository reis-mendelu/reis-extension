export function findHeaderRow(doc: Document, searchTexts: string[]): Element | null {
  const boldTags = Array.from(doc.querySelectorAll('td.odsazena b, b, span, strong, h1, h2, h3'));
  for (const tag of boldTags) {
    // Normalize non-breaking spaces (&nbsp; → regular space) before matching
    const text = (tag.textContent?.trim() ?? '').replace(/\u00a0/g, ' ');
    if (searchTexts.some(s => text.includes(s))) {
      return tag.closest('tr');
    }
  }
  return null;
}
