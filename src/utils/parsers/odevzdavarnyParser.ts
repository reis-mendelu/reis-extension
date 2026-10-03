// Parser for IS odevzdavarny.pl — the three submission-box tables.
//
// The page lists every box of the period in exactly one of three tables, and a
// box MOVES between them: uploading takes it out of "Kam mohu odevzdávat" and
// into "Odevzdávárny s odevzdanými soubory". Reading only the first table is
// how a box vanished from reIS the moment a student had handed it in.
//
// Verified against real pages for three periods (fixtures in
// src/api/__tests__/fixtures/odevzdavarny/). Each table has its own layout,
// so the column indices below are per table and load-bearing.

export type OdevzdavarnaSection = 'open' | 'submitted' | 'closed';

export interface ParsedOdevzdavarna {
  section: OdevzdavarnaSection;
  courseId: string;
  courseCode: string;
  courseName: string;
  name: string;
  type: string;
  /** As IS prints it. Only the Czech page's DD.MM.YYYY is safe to parse. */
  deadline: string;
  odevzdavarnaId: string;
  fileCount: number;
  /** The student's points, only in the submitted table and only once graded. */
  points?: string;
  /** Whether IS still accepts files. */
  isOpen: boolean;
  /** Upload / view-files page for this box; '' when IS gives none. */
  uploadUrl: string;
}

interface Layout {
  cells: number;
  deadline: number;
  status: number | null;
  points: number | null;
  details: number;
  files: number;
  link: number;
}

// Header row, cz/en (verified 2026-10-03):
// open:      Název předmětu | Název | Typ | Vypsáno pro | Dokdy | Téma | Podrobnosti | Počet souborů | Pokyny | Vypsal | Vkládat soubory
// submitted: … | Téma | Otevřená | Body | Podrobnosti | Počet souborů | Pokyny | Vypsal | Zobrazit soubory
// closed:    … | Téma | Otevřená | Podrobnosti | Počet souborů | Pokyny | Vypsal | Zobrazit soubory
const LAYOUTS: Record<OdevzdavarnaSection, Layout> = {
  open: { cells: 11, deadline: 4, status: null, points: null, details: 6, files: 7, link: 10 },
  submitted: { cells: 13, deadline: 4, status: 6, points: 7, details: 8, files: 9, link: 12 },
  closed: { cells: 12, deadline: 4, status: 6, points: null, details: 7, files: 8, link: 11 },
};

const MARKERS: Record<'cz' | 'en', Record<OdevzdavarnaSection, string>> = {
  cz: {
    open: 'Kam mohu odevzd',
    submitted: 'Odevzdávárny s odevzdanými',
    closed: 'Kam nemohu odevzd',
  },
  en: {
    open: 'Where I can submit',
    submitted: 'Coursework submissions with submitted',
    closed: 'Where I cannot submit',
  },
};

const SECTIONS: OdevzdavarnaSection[] = ['open', 'submitted', 'closed'];

const text = (el: Element | undefined | null) =>
  (el?.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

const follows = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** First table after `start` and before `stop` — never the next section's. */
function tableBetween(doc: Document, start: Element, stop: Element | null) {
  const tables = doc.getElementsByTagName('table');
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]!;
    if (follows(start, t) && (!stop || follows(t, stop))) return t;
  }
  return null;
}

function absolute(href: string): string {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `https://is.mendelu.cz${href}`;
  return `https://is.mendelu.cz/auth/student/${href}`;
}

function parseRow(cols: HTMLCollectionOf<Element>, section: OdevzdavarnaSection) {
  const L = LAYOUTS[section];
  const courseLink = cols[0]!.getElementsByTagName('a')[0];
  const rawCourse = text(courseLink) || text(cols[0]);
  const codeMatch = rawCourse.match(/^([A-Z]{2,4}-[A-Z0-9]+) /);
  const courseId = courseLink?.getAttribute('href')?.match(/predmet=(\d+)/)?.[1] ?? '';
  const icon = cols[2]!.querySelector('[data-sysid], img[sysid]');
  const statusSysid = L.status === null ? '' : (cols[L.status]!.querySelector('[data-sysid]')?.getAttribute('data-sysid') ?? '');
  const linkHref = cols[L.link]!.getElementsByTagName('a')[0]?.getAttribute('href') ?? '';
  const detailsHref = cols[L.details]!.getElementsByTagName('a')[0]?.getAttribute('href') ?? '';
  const id = (linkHref + ' ' + detailsHref).match(/odevzdavarna=(\d+)/)?.[1] ?? '';
  const points = L.points === null ? '' : text(cols[L.points]);

  const row: ParsedOdevzdavarna = {
    section,
    courseId,
    courseCode: codeMatch?.[1] ?? '',
    courseName: codeMatch ? rawCourse.slice(codeMatch[0].length) : rawCourse,
    name: text(cols[1]),
    type: icon?.getAttribute('data-sysid') ?? icon?.getAttribute('sysid') ?? '',
    deadline: text(cols[L.deadline]),
    odevzdavarnaId: id,
    fileCount: parseInt(text(cols[L.files]), 10) || 0,
    isOpen:
      section === 'open' ? true : section === 'closed' ? false : !statusSysid.includes('zavren'),
    uploadUrl: absolute(linkHref),
  };
  if (points) row.points = points;
  return row;
}

/**
 * Every box on the page, in table order (open, submitted, closed).
 *
 * `null` means "this is not the page we expected" — no section marker at all
 * (a login or error page, which IS also serves as 200), or a table whose header
 * no longer has the known number of columns. Callers keep their cache on null;
 * only a real, recognised page may say "no boxes".
 */
export function parseOdevzdavarnyPage(
  doc: Document,
  lang: 'cz' | 'en'
): ParsedOdevzdavarna[] | null {
  const bolds = Array.from(doc.getElementsByTagName('b'));
  const markerEls = SECTIONS.map((s) => bolds.find((b) => text(b).startsWith(MARKERS[lang][s])) ?? null);
  if (markerEls.every((m) => m === null)) return null;

  const rows: ParsedOdevzdavarna[] = [];
  for (let s = 0; s < SECTIONS.length; s++) {
    const section = SECTIONS[s]!;
    const marker = markerEls[s];
    if (!marker) continue;
    const stop = markerEls.slice(s + 1).find((m) => m !== null) ?? null;
    const table = tableBetween(doc, marker, stop);
    if (!table) continue;

    const trs = table.getElementsByTagName('tr');
    const headerCells = trs[0]?.getElementsByTagName('th').length ?? 0;
    if (headerCells !== LAYOUTS[section].cells) return null;

    for (let i = 1; i < trs.length; i++) {
      const cols = trs[i]!.getElementsByTagName('td');
      // The "Nenalezena žádná vyhovující data" row is one spanning cell.
      if (cols.length !== LAYOUTS[section].cells) continue;
      const row = parseRow(cols, section);
      if (row.courseName && row.name) rows.push(row);
    }
  }
  return rows;
}

/**
 * The student's periods from the page's own `<select name="obdobi">`, in IS
 * order — oldest first (verified: 801 ZS 25/26, 812 LS 25/26, 829 ZS 26/27).
 */
export function parsePeriodIds(doc: Document): string[] {
  const select = doc.querySelector('select[name="obdobi"]');
  if (!select) return [];
  return Array.from(select.querySelectorAll('option'))
    .map((o) => o.getAttribute('value') ?? '')
    .filter(Boolean);
}
