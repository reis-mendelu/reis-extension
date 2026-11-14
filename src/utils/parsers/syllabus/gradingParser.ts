import { findHeaderRow } from './findHeaderRow';

const TABLE_LABELS = [
  'Rozložení požadavků na ukončení',
  'Assessment criteria ratio',
  'Podíl kritérií na hodnocení',
];

/**
 * InSIS (VŠE) prints the same activity → weight table under "Způsoby a kritéria
 * hodnocení". Its "Hodnocení:" row is the grade scale, not requirements, and a
 * bare "Hodnocení" would also match MENDELU's "Podíl kritérií na hodnocení".
 * Tried only when no MENDELU label matched.
 */
const INSIS_TABLE_LABELS = ['Způsoby a kritéria hodnocení:', 'Assessment methods and criteria:'];

export function parseRequirementsTable(doc: Document) {
  const row = findHeaderRow(doc, TABLE_LABELS) ?? findHeaderRow(doc, INSIS_TABLE_LABELS);
  const table = row?.nextElementSibling?.querySelector('table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr'))
    .map((r) =>
      Array.from(r.querySelectorAll('th, td')).map((c) =>
        (c.textContent || '').trim().replace(/\s+/g, ' ')
      )
    )
    .filter((r) => r.length > 0);
}
