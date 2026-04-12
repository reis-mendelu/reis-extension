import { fetchWithAuth, BASE_URL } from './client';
import { loggers } from '../utils/logger';
import type {
  LearningAgreementData,
  LACourse,
  LAEligibleCourse,
  LAGenericCourse,
  LAInstitution,
  LACoordinator,
} from '../types/erasmusLA';

const LA_URL = `${BASE_URL}/auth/int/predmety_plan.pl`;

/**
 * Fetch + parse the Erasmus Learning Agreement page.
 * IS auto-redirects from obdobi+studium to the correct zadost.
 */
export async function fetchLearningAgreement(
  studium: string,
  obdobi: string,
  lang: 'cz' | 'en' = 'cz',
): Promise<LearningAgreementData | null> {
  try {
    const url = `${LA_URL}?obdobi=${obdobi};studium=${studium};lang=${lang}`;
    const res = await fetchWithAuth(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const zadostMatch = html.match(/zadost=(\d+)/);
    if (!zadostMatch) return null;

    return parseLearningAgreement(doc, zadostMatch[1], studium);
  } catch (err) {
    loggers.api.error('[ErasmusLA] Fetch failed:', err);
    return null;
  }
}

function parseLearningAgreement(
  doc: Document,
  zadost: string,
  studium: string,
): LearningAgreementData {
  return {
    zadost,
    studium,
    courses: parseTableCourses(doc),
    eligibleCourses: parseSelectOptions(doc, 'predmety_plan'),
    genericCourses: parseSelectOptions(doc, 'predmety_obecne'),
    availablePeriods: parsePeriodSelect(doc),
    institution: parseInstitution(doc),
    sendingCoordinator: parseCoordinatorBlock(doc, 'dts_send_koord'),
    receivingCoordinator: parseCoordinatorBlock(doc, 'dts_rec_koord'),
    receivingFacultyCoordinator: parseCoordinatorBlock(doc, 'dts_rec_fak_koord'),
    contactPhone: getInputValue(doc, 'dts_kont_telefon_1'),
    contactEmail: getInputValue(doc, 'dts_kont_email_1'),
    subjectAreaCode: getInputValue(doc, 'dts_stud_subj_area_kod_1'),
    motherLanguage: getSelectedText(doc, 'dts_ost_mat_jazyk_1'),
    canSubmit: !!doc.querySelector('input[name="pozadat_la"]'),
  };
}

/** Parse courses from table_1 (the current LA table). */
function parseTableCourses(doc: Document): LACourse[] {
  const table = doc.getElementById('table_1');
  if (!table) return [];

  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const courses: LACourse[] = [];

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td'));
    // Empty table shows a single row with colspan
    if (cells.length < 5) continue;
    if (cells[0]?.getAttribute('colspan')) continue;

    // Columns: Ozn. | Kód | Předmět | Období | ECTS | [hidden: Ukon. | Jaz. | Výsledek] | Změněno | Změnil | Uznáno | Uznal | Upravit
    // visible indexes (when hidden cols are display:none): 0=checkbox, 1=code, 2=name, 3=period, 4=credits
    // We read ALL cells including hidden ones for completeness
    const allCells = cells.filter(c => !c.classList.contains('UISTMNumberCellHidden'));
    if (allCells.length < 5) continue;

    courses.push({
      code: text(allCells[1]),
      name: text(allCells[2]),
      period: text(allCells[3]),
      credits: parseInt(text(allCells[4]), 10) || 0,
      completion: text(cells[5]),
      language: text(cells[6]),
      result: text(cells[7]),
      changedDate: text(cells[8]),
      changedBy: text(cells[9]),
      recognizedDate: text(cells[10]),
      recognizedBy: text(cells[11]),
    });
  }

  return courses;
}

/**
 * Parse a <select> dropdown into structured course options.
 * Format: "EBC-AOS Architektura operačních systémů (LS 2025/2026 - PEF)"
 */
function parseSelectOptions(
  doc: Document,
  selectName: string,
): LAEligibleCourse[] {
  const select = doc.querySelector(`select[name="${selectName}"]`);
  if (!select) return [];

  const options = Array.from(select.querySelectorAll('option'));
  const courses: LAEligibleCourse[] = [];

  for (const opt of options) {
    const id = opt.getAttribute('value') || '';
    if (!id || id === '0') continue;

    const label = (opt.textContent || '').trim();
    const match = label.match(
      /^([A-Z]{2,4}-[A-Z0-9]+)\s+(.+?)\s+\(([^)]+)\s+-\s+([^)]+)\)$/,
    );
    if (match) {
      courses.push({
        id,
        code: match[1],
        name: match[2],
        period: match[3].trim(),
        faculty: match[4].trim(),
      });
    } else {
      // Fallback for non-standard format (e.g. UP1, UP2 without faculty prefix)
      const fallback = label.match(/^(\S+)\s+(.+?)\s+\(([^)]+)\s+-\s+([^)]+)\)$/);
      if (fallback) {
        courses.push({
          id,
          code: fallback[1],
          name: fallback[2],
          period: fallback[3].trim(),
          faculty: fallback[4].trim(),
        });
      }
    }
  }

  return courses;
}

/** Parse the period selector dropdown. */
function parsePeriodSelect(
  doc: Document,
): { id: string; label: string; selected: boolean }[] {
  const select = doc.querySelector('select[name="univ_usek"]');
  if (!select) return [];

  return Array.from(select.querySelectorAll('option'))
    .filter(opt => opt.getAttribute('value') !== '0')
    .map(opt => ({
      id: opt.getAttribute('value') || '',
      label: (opt.textContent || '').trim(),
      selected: opt.hasAttribute('selected'),
    }));
}

/** Parse receiving institution form fields. */
function parseInstitution(doc: Document): LAInstitution | null {
  const faculty = getInputValue(doc, 'dts_rec_fak_1');
  if (!faculty) return null;

  return {
    faculty,
    address: getInputValue(doc, 'dts_rec_adr_1'),
    dateFrom: getInputValue(doc, 'dts_rec_odkdy_1'),
    dateTo: getInputValue(doc, 'dts_rec_dokdy_1'),
    languageLevel: getSelectedText(doc, 'dts_rec_jazyk_znalost_1'),
    catalogUrl: getInputValue(doc, 'dts_rec_katalog_url_1'),
  };
}

/** Parse a coordinator block (first/last name, phone, email). */
function parseCoordinatorBlock(
  doc: Document,
  prefix: string,
): LACoordinator | null {
  const first = getInputValue(doc, `${prefix}_jmeno_1`);
  const last = getInputValue(doc, `${prefix}_prijmeni_1`);
  if (!first && !last) return null;

  return {
    firstName: first,
    lastName: last,
    phone: getInputValue(doc, `${prefix}_telefon_1`),
    email: getInputValue(doc, `${prefix}_email_1`),
  };
}

function getInputValue(doc: Document, name: string): string {
  const input = doc.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
  return input?.value?.trim() || '';
}

function getSelectedText(doc: Document, name: string): string {
  const select = doc.querySelector(`select[name="${name}"]`) as HTMLSelectElement | null;
  if (!select) return '';
  const selected = select.querySelector('option[selected]');
  return (selected?.textContent || '').trim();
}

function text(el: Element | undefined): string {
  return (el?.textContent || '').trim();
}
