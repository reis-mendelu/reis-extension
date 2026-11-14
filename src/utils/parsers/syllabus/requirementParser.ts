import { findHeaderRow } from './findHeaderRow';

const REQUIREMENTS_LABELS = [
  'Požadavky na ukončení',
  'Requirements for completion',
  'Assessment methods:',
  'Metody hodnocení:',
];

/**
 * InSIS (VŠE) has no "Požadavky na ukončení"; its pass conditions in prose sit
 * under "Zvláštní podmínky a podrobnosti". Its "Způsoby a kritéria hodnocení"
 * holds only the weights table, which `parseRequirementsTable` reads.
 * Tried only when no MENDELU label matched: `findHeaderRow` matches by
 * "contains" in document order, so mixing the lists could change what a
 * MENDELU page matches.
 */
const INSIS_REQUIREMENTS_LABELS = [
  'Zvláštní podmínky a podrobnosti:',
  'Special requirements and details:',
];

export function parseRequirementsText(doc: Document) {
  const row =
    findHeaderRow(doc, REQUIREMENTS_LABELS) ?? findHeaderRow(doc, INSIS_REQUIREMENTS_LABELS);
  const contentRow = row?.nextElementSibling;
  const cell = contentRow?.querySelector('td');

  if (!cell) return 'Error: Section not found';

  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return (clone.textContent || '')
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l.length > 0)
    .join('\n');
}
