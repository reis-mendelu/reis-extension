import type { AttendanceRecord } from '../types/documents';

export interface AttendanceSummary {
  /** Sessions the student was at: present, elsewhere, late or left early. */
  attended: number;
  /** Sessions that count: everything but excused and excluded ones. */
  counted: number;
  absent: number;
}

export function summarizeAttendance(records: AttendanceRecord[]): AttendanceSummary {
  let attended = 0;
  let counted = 0;
  let absent = 0;
  for (const r of records) {
    if (r.status === 'excused' || r.status === 'excluded') continue;
    counted++;
    if (r.status === 'absent') absent++;
    else attended++;
  }
  return { attended, counted, absent };
}

// Whether the Czech word for the leading part starts with s/z/š/ž or a cluster
// that takes "ze": jednoho, dvou, tří, čtyř, pěti, šesti, sedmi, osmi, devíti.
const UNITS_ZE = [false, false, true, true, true, false, true, true, false, false];
// deseti, jedenácti, dvanácti, třinácti, čtrnácti, patnácti, šestnácti, sedmnácti, osmnácti, devatenácti
const TEENS_ZE = [false, false, true, true, true, false, true, true, false, false];
// dvaceti, třiceti, čtyřiceti, padesáti, šedesáti, sedmdesáti, osmdesáti, devadesáti
const TENS_ZE = [false, false, true, true, true, false, true, true, false, false];

/** "z" or "ze" before a written number: "1 z 2", "2 ze 3", "4 z 5". */
export function czFromPreposition(n: number): 'z' | 'ze' {
  if (n >= 100) {
    const h = Math.floor(n / 100) % 10;
    // sta, dvou set, tří set, čtyř set, pěti set, …
    return h === 1 || UNITS_ZE[h] ? 'ze' : 'z';
  }
  if (n >= 20) return TENS_ZE[Math.floor(n / 10)] ? 'ze' : 'z';
  if (n >= 10) return TEENS_ZE[n - 10] ? 'ze' : 'z';
  return UNITS_ZE[n] ? 'ze' : 'z';
}

/** "20. 10. 2026" → "20. 10." — the year is the current one and only costs width. */
export function shortDate(date: string): string {
  return date.replace(/\s*\d{4}\s*$/, '');
}

/** "13.00-14.50" → "13.00–14.50". */
export function dashRange(text: string): string {
  return text.replace(/(\d)-(\d)/g, '$1–$2');
}

/** IS labels a group "EBC-M Cv Út 13.00-14.50 Q05"; the subject is already on screen. */
export function groupDetail(label: string, courseCode: string): string {
  const rest = label.startsWith(courseCode) ? label.slice(courseCode.length) : label;
  return dashRange(rest.trim());
}
