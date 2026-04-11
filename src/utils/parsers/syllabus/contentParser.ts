import { findHeaderRow } from './findHeaderRow';

const CONTENT_LABELS = [
  'Obsah předmětu',
  'Course content',
  'Course contents',
  'Content of the course',
];

/**
 * Extracts course topic list as flat text.
 * The HTML is a nested table: top-level rows are numbered chapters (bold),
 * each followed by a sub-table of lettered sub-topics.
 * Output: "1. Chapter title\na. Sub-topic\nb. Sub-topic\n2. ..."
 */
export function parseCourseContent(doc: Document): string | null {
  const row = findHeaderRow(doc, CONTENT_LABELS);
  const contentRow = row?.nextElementSibling;
  const cell = contentRow?.querySelector('td');
  if (!cell) return null;

  const lines: string[] = [];

  // Structure: alternating pairs of rows in the top-level table.
  // Odd rows: <td><b>N.</b></td> <td><b>Chapter title</b> (dotace X/Y)</td>
  // Even rows: <td>&nbsp;</td>   <td><table>...sub-topics...</table></td>
  const topRows = Array.from(cell.querySelectorAll(':scope > table > tbody > tr'));
  for (let i = 0; i < topRows.length; i++) {
    const tr = topRows[i];
    const cells = tr.querySelectorAll(':scope > td');
    if (cells.length < 2) continue;

    const label = (cells[0].textContent?.trim() ?? '').replace(/\u00a0/g, ' ');

    if (/^\d+\.$/.test(label)) {
      // Chapter row — extract bold title, strip "(dotace N/N)"
      const titleEl = cells[1].querySelector('b');
      const title = ((titleEl?.textContent ?? cells[1].textContent ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\(dotace[^)]+\)/g, '')
        .trim());
      if (title) lines.push(`${label} ${title}`);

      // Sub-topics live in the immediately following row's second cell
      const subRow = topRows[i + 1];
      if (subRow) {
        const subCells = subRow.querySelectorAll(':scope > td');
        const subContainer = subCells[subCells.length - 1]; // last cell holds sub-table
        if (subContainer) {
          for (const subTr of subContainer.querySelectorAll('tr')) {
            const sc = subTr.querySelectorAll('td');
            if (sc.length < 2) continue;
            const subLabel = (sc[0].textContent?.trim() ?? '').replace(/\u00a0/g, ' ');
            const subText = (sc[1].textContent?.trim() ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
            if (subLabel && subText) lines.push(`  ${subLabel} ${subText}`);
          }
        }
      }
    }
  }

  if (lines.length === 0) {
    // Fallback: plain text extraction
    const clone = cell.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    const text = (clone.textContent ?? '')
      .split('\n')
      .map(l => l.trim().replace(/\s+/g, ' '))
      .filter(l => l.length > 0)
      .join('\n');
    return text || null;
  }

  return lines.join('\n');
}
