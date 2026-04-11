import { findHeaderRow } from './findHeaderRow';

const OBJECTIVES_LABELS = [
  'Cíl předmětu a studijní výstupy',
  'Aims of the course and learning outcomes',
  'Course objectives and learning outcomes',
  'Aims of the course',
];

export function parseCourseObjectives(doc: Document): string | null {
  const row = findHeaderRow(doc, OBJECTIVES_LABELS);
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
