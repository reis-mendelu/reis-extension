import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import type { ErasmusStudentInfo, ErasmusUniversityOption } from '@/store/types';
import type { SubjectStatus } from '@/types/studyPlan';

const MARGIN = 15;
const PAGE_W = 210;

// Colour palette
const LAV: [number, number, number] = [198, 224, 180]; // light green section headers
const GRY: [number, number, number] = [217, 217, 217]; // gray column headers
const GRN: [number, number, number] = [0, 104, 56];    // MENDELU green
const BDR: [number, number, number] = [166, 166, 166]; // cell borders
const WHT: [number, number, number] = [255, 255, 255];
const BLK: [number, number, number] = [0, 0, 0];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cell = Record<string, any>;

// jsPDF's built-in Helvetica only covers Latin-1; strip combining diacritics so
// Czech/Slovak characters don't render as spaced-out garbled glyphs.
function safe(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const base = { font: 'helvetica', fontSize: 9, cellPadding: 2, lineColor: BDR, lineWidth: 0.2 };

function secCell(text: string, span: number): Cell {
  return { content: text, colSpan: span, styles: { fillColor: GRY, textColor: BLK, halign: 'left', valign: 'middle', minCellHeight: 7 } };
}
function hdrCell(text: string): Cell {
  return { content: text, styles: { fillColor: GRY, textColor: BLK, fontStyle: 'bold', halign: 'center', valign: 'middle', minCellHeight: 10 } };
}
function datCell(text: string, link = false): Cell {
  return { content: safe(text), styles: { fillColor: WHT, textColor: GRN, fontStyle: link ? 'normal' : 'bold', halign: 'center', valign: 'middle', minCellHeight: 10 } };
}
function bdy(text: string, halign = 'left'): Cell {
  return { content: safe(text), styles: { fillColor: WHT, textColor: BLK, halign, minCellHeight: 8 } };
}

function drawTable(doc: jsPDF, y: number, body: Cell[][], colWidths: number[]): number {
  const columnStyles: Record<number, { cellWidth: number }> = {};
  colWidths.forEach((w, i) => { columnStyles[i] = { cellWidth: w }; });
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: 0, bottom: 0 },
    theme: 'grid',
    styles: base,
    columnStyles,
    body,
    showHead: 'never',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? y;
}

function courseTable(doc: jsPDF, y: number, label: string, rows: { code: string; name: string; credits: number }[], minRows = 0): number {
  const total = rows.reduce((s, r) => s + r.credits, 0);
  const padded = rows.length < minRows
    ? [...rows, ...Array(minRows - rows.length).fill({ code: '', name: '', credits: 0 })]
    : rows;
  return drawTable(doc, y, [
    [{ content: label, colSpan: 3, styles: { fillColor: WHT, textColor: BLK, fontSize: 8, minCellHeight: 7 } }],
    [hdrCell('Code'), hdrCell('Course name'), hdrCell('ECTS (credits)')],
    ...padded.map(r => [bdy(r.code), bdy(r.name), bdy(r.credits > 0 ? String(r.credits) : '', 'right')]),
    [{ content: '', colSpan: 2, styles: { fillColor: WHT } }, { content: 'Total', styles: { fillColor: WHT, fontStyle: 'bold', halign: 'right' } }, bdy(String(total), 'right')],
  ], [22, 136, 22]);
}

export async function downloadErasmusPdf(
  info: ErasmusStudentInfo,
  options: ErasmusUniversityOption[],
  tableBCourses: Record<string, string[]>,
  allSubjects: SubjectStatus[],
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const subjectMap = new Map(allSubjects.map(s => [s.code, s]));

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(BLK[0], BLK[1], BLK[2]);
  doc.text('Learning agreement proposal', PAGE_W / 2, MARGIN + 7, { align: 'center' });

  let y = MARGIN + 14;

  // Student section
  y = drawTable(doc, y, [
    [secCell('Student', 6)],
    [hdrCell('Last name(s)'), hdrCell('First name(s)'), hdrCell('Date of birth'), hdrCell('Code of study'), hdrCell('Semester\nof stay'), hdrCell("User's\nidentification\nnumber")],
    [datCell(info.lastName), datCell(info.firstName), datCell(info.dob), datCell(info.studyCode), datCell(info.semester), datCell(info.studentId)],
  ], [30, 30, 30, 30, 30, 30]);

  y += 6;

  for (const [i, option] of options.entries()) {
    const bRows = (tableBCourses[option.id] ?? []).map(code => {
      const s = subjectMap.get(code);
      return { code, name: s?.name ?? code, credits: s && s.credits < 999 ? s.credits : 0 };
    });

    // Institution header
    y = drawTable(doc, y, [
      [secCell(`${i + 1}. Institution`, 4)],
      [hdrCell('Name of the institution'), hdrCell('Erasmus code'), hdrCell('Country'), hdrCell('Link to course catalogue')],
      [datCell(option.institutionName), datCell(option.erasmusCode), datCell(option.country), datCell(option.link, true)],
    ], [72, 28, 26, 54]);

    // Table A — no padding, show exactly what was entered
    y = courseTable(doc, y, 'Table A: Courses you plan to study at receiving institution', option.courses);

    // Table B — pad to at least Table A's count so there's a row per A-course to fill in
    y = courseTable(doc, y, 'Table B: Courses to be recognised at sending institution', bRows, option.courses.length);

    y += 6;
  }

  const blob = doc.output('blob');
  const filename = info.studentId ? `la-${info.studentId}.pdf` : 'learning-agreement.pdf';
  saveAs(blob, filename);
}
