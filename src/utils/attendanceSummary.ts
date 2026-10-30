import type { AttendanceRecord, SubjectAttendance } from '../types/documents';

/** The groups that have anything recorded; IS lists empty ones too. */
export function recordedGroups(groups: SubjectAttendance[] | undefined): SubjectAttendance[] {
  return groups?.filter((g) => g.records.length > 0) ?? [];
}

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

// Whether the genitive of the leading part takes "ze" (it starts with s/z/š/ž
// or a cluster): dvou, tří, čtyř, šesti, sedmi do; jednoho, pěti, osmi, devíti
// don't. Indexed by the digit.
const UNITS_ZE = [false, false, true, true, true, false, true, true, false, false];
// Teens by n − 10: dvanácti, třinácti, čtrnácti, šestnácti, sedmnácti take "ze";
// deseti, jedenácti, patnácti, osmnácti, devatenácti don't.
const TEENS_ZE = [false, false, true, true, true, false, true, true, false, false];
// Tens by the tens digit: dvaceti, třiceti, čtyřiceti, šedesáti, sedmdesáti take
// "ze"; padesáti, osmdesáti, devadesáti don't.
const TENS_ZE = [false, false, true, true, true, false, true, true, false, false];

/** "z" or "ze" before a written number: "1 ze 2", "2 ze 3", "4 z 5". */
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

/**
 * "20. 10. 2026" → "20. 10." when 2026 is this year: then the year only costs
 * width. Another year stays — a winter semester crosses New Year, and in
 * January "20. 10." would read as the October ahead (release review).
 */
export function shortDate(date: string, now: Date = new Date()): string {
  const year = /\s*(\d{4})\s*$/.exec(date);
  return year && Number(year[1]) === now.getFullYear() ? date.slice(0, year.index) : date;
}

/** "13.00-14.50" → "13.00–14.50". */
export function dashRange(text: string): string {
  return text.replace(/(\d)-(\d)/g, '$1–$2');
}

/**
 * IS labels a group "EBC-M Cv Út 13.00-14.50 Q05". The subject is already on
 * screen and every row names the room, so both come off: "Cv Út 13.00–14.50".
 */
export function groupDetail(label: string, courseCode: string, room?: string): string {
  let rest = label.startsWith(courseCode) ? label.slice(courseCode.length) : label;
  rest = rest.trim();
  if (room && rest.endsWith(` ${room}`)) rest = rest.slice(0, -room.length).trim();
  return dashRange(rest);
}
