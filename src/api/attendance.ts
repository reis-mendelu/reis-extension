import type { SubjectAttendance, AttendanceRecord, AttendanceStatus } from '../types/documents';

// Attendance from IS's "List záznamníku učitele" (list.pl, #tmtab_1), split out
// of subjects.ts. Tested on real pages in __tests__/fixtures/list-zaznamniku/.

const SYSID_TO_STATUS: Record<string, AttendanceStatus> = {
  'doch-pritomen': 'present',
  'doch-neomluven': 'absent',
  'doch-omluven': 'excused',
  'doch-pozde': 'late',
  'doch-drivejsi-odchod': 'early-leave',
  'doch-vyloucen': 'excluded',
  'doch-pritomen-jinde': 'elsewhere',
};

export function parseAttendance(htmlString: string): Record<string, SubjectAttendance[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const table = doc.querySelector('#tmtab_1');
  if (!table) return {};

  const result: Record<string, SubjectAttendance[]> = {};
  let currentCode: string | null = null;

  const rows = table.querySelectorAll('tr.uis-hl-table');
  for (const row of rows) {
    // IS puts a subject's FIRST rozvrhová akce on the subject's own row, next to
    // the syllabus link; further actions get rows of their own. So a subject row
    // switches the subject and is then read like any action row — a one-action
    // subject (a lone cvičení, every combined-form subject) has only that row.
    const syllabusLink = row.querySelector('a[href*="/auth/katalog/syllabus.pl"]');
    if (syllabusLink) {
      const fullName = syllabusLink.textContent?.trim() || '';
      currentCode = fullName.split(' ')[0] || null;
    }

    if (!currentCode) continue;

    // Both icon markups IS has served: <img sysid> before, and now (seen
    // 2026-10-18 on list.pl, data-nove_ikonky="1") <span data-sysid> wrapping an
    // inline SVG, carrying the same title.
    const icons = row.querySelectorAll('[data-sysid^="doch-"], img[sysid^="doch-"]');
    if (icons.length === 0) continue;

    // The "Kdy" cell is the first non-empty cell that is not the subject's name.
    // Its index differs by markup: the old subject rows led with a <small> cell,
    // and a sub-row's subject cell is a rowspan on the row above.
    const kdyCell = Array.from(row.querySelectorAll('td')).find(
      (td) => !td.contains(syllabusLink) && td.textContent?.trim()
    );
    const label =
      kdyCell?.textContent
        ?.trim()
        .replace(/\s*Každý týden\s*/g, '')
        .trim() || '';

    const records: AttendanceRecord[] = [];
    for (const icon of icons) {
      const sysid = icon.getAttribute('data-sysid') || icon.getAttribute('sysid') || '';
      const status = SYSID_TO_STATUS[sysid];
      if (!status) continue;

      const title = icon.getAttribute('title') || '';
      const parts = title.split(', ');
      if (parts.length < 3) continue;

      const [datePart = '', timePart = ''] = parts;
      const roomAndStatus = parts.slice(2).join(', ');
      const room = roomAndStatus.split(' - ')[0] ?? '';

      records.push({ date: datePart, time: timePart, room, status });
    }

    if (records.length > 0) {
      (result[currentCode] ??= []).push({ label, records });
    }
  }

  return result;
}
