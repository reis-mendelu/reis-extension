import { findHeaderRow } from './findHeaderRow';

const OBJECTIVES_LABELS = [
  'Cíl předmětu a studijní výstupy',
  'Aims of the course and learning outcomes',
  'Course objectives and learning outcomes',
  'Aims of the course',
];

/**
 * InSIS (VŠE): "Zaměření předmětu" is the Czech twin of "Aims of the course",
 * which the English page already matches above, so both languages show the
 * same section. Tried only when no MENDELU label matched.
 */
const INSIS_OBJECTIVES_LABELS = ['Zaměření předmětu:'];

export function parseCourseObjectives(doc: Document): string | null {
  const row = findHeaderRow(doc, OBJECTIVES_LABELS) ?? findHeaderRow(doc, INSIS_OBJECTIVES_LABELS);
  const contentRow = row?.nextElementSibling;
  const cell = contentRow?.querySelector('td');
  if (!cell) return null;

  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  const text = (clone.textContent ?? '')
    .split('\n')
    .map(l => l.trim().replace(/\s+/g, ' '))
    .filter(l => l.length > 0)
    .join('\n');

  return text || null;
}
