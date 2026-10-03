import { fetchWithAuth, BASE_URL } from './client';
import { logError } from '../utils/reportError';
import {
  parseOdevzdavarnyPage,
  parsePeriodIds,
  type OdevzdavarnaSection,
  type ParsedOdevzdavarna,
} from '../utils/parsers/odevzdavarnyParser';

export interface Odevzdavarna {
  courseId: string;
  courseNameCs: string;
  courseNameEn: string;
  name: string;
  type: string;
  deadline: string;
  odevzdavarnaId: string;
  fileCount: number;
  uploadUrl: string;
  // Optional: rows cached by a build that read only the open table have none
  // of these, and must still read as open boxes (see isBoxOpen).
  courseCode?: string;
  /** Which IS table the box sits in. Uploading moves it to 'submitted'. */
  section?: OdevzdavarnaSection;
  /** Whether IS still accepts files. */
  isOpen?: boolean;
  /** The student's points, once graded. */
  points?: string;
  /** The IS period the box belongs to — the sync reads two. */
  obdobi?: string;
}

async function fetchLang(
  studium: string,
  obdobi: string,
  lang: 'cz' | 'en'
): Promise<{ rows: ParsedOdevzdavarna[]; periods: string[] } | null> {
  try {
    const url = `${BASE_URL}/auth/student/odevzdavarny.pl?studium=${studium};obdobi=${obdobi};lang=${lang}`;
    // fetchWithAuth, not a bare fetch: IS denies CORS to every origin, so
    // this cannot reach it from the Capacitor app's own origin.
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch odevzdavarny');

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = parseOdevzdavarnyPage(doc, lang);
    if (!rows) throw new Error('Unrecognised odevzdavarny page');
    return { rows, periods: parsePeriodIds(doc) };
  } catch (error) {
    logError('Api.fetchOdevzdavarnyLang', error, { lang });
    return null;
  }
}

export interface OdevzdavarnyResult {
  assignments: Odevzdavarna[];
  lastFetched: number;
  /** The student's period ids from the page, oldest first. */
  periods: string[];
}

/**
 * Every submission box of the period, open, handed in and closed.
 *
 * Czech is the source of truth: the English page prints deadlines as
 * MM/DD/YYYY, so it contributes course names only, matched per table and row
 * and only when the course id agrees.
 */
export async function fetchOdevzdavarny(
  studium: string,
  obdobi: string
): Promise<OdevzdavarnyResult | null> {
  const [czPage, enPage] = await Promise.all([
    fetchLang(studium, obdobi, 'cz'),
    fetchLang(studium, obdobi, 'en'),
  ]);

  if (!czPage) return null;
  const czData = czPage.rows;
  const enData = enPage?.rows;

  const listUrl = `${BASE_URL}/auth/student/odevzdavarny.pl?studium=${studium};obdobi=${obdobi}`;
  const enBySection = (section: OdevzdavarnaSection) =>
    (enData ?? []).filter((r) => r.section === section);
  const position = new Map<OdevzdavarnaSection, number>();

  const byId = new Map<string, Odevzdavarna>();
  const merged: Odevzdavarna[] = [];
  for (const cz of czData) {
    const i = position.get(cz.section) ?? 0;
    position.set(cz.section, i + 1);
    const en = enBySection(cz.section)[i];

    const box: Odevzdavarna = {
      courseId: cz.courseId,
      courseCode: cz.courseCode,
      courseNameCs: cz.courseName,
      courseNameEn: en && en.courseId === cz.courseId ? en.courseName : cz.courseName,
      name: cz.name,
      type: cz.type,
      deadline: cz.deadline,
      odevzdavarnaId: cz.odevzdavarnaId,
      fileCount: cz.fileCount,
      uploadUrl: cz.uploadUrl || listUrl,
      section: cz.section,
      isOpen: cz.isOpen,
      obdobi,
    };
    if (cz.points) box.points = cz.points;

    // One box, one row. The real pages never list a box twice, but if IS ever
    // keeps an open box in both tables, the first (open) row wins and borrows
    // the graded points from the other.
    const seen = cz.odevzdavarnaId ? byId.get(cz.odevzdavarnaId) : undefined;
    if (seen) {
      if (!seen.points && box.points) seen.points = box.points;
      continue;
    }
    if (cz.odevzdavarnaId) byId.set(cz.odevzdavarnaId, box);
    merged.push(box);
  }

  return { assignments: merged, lastFetched: Date.now(), periods: czPage.periods };
}
