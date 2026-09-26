import type { RozvrhRef } from './types';
import { txt } from './text';

export interface RangeRef {
  z: string;
  k: string;
}

export interface CriteriaProgramme {
  programId: string;
  shortCode: string;
  name: string;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** Validity ranges linked from `rozvrhy_view.pl?konf=1`. */
export function parseRanges(doc: Document): RangeRef[] {
  const out: RangeRef[] = [];
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const m = /z=(\d{8});k=(\d{8})/.exec(a.getAttribute('href') ?? '');
    if (!m?.[1] || !m[2]) continue;
    const [z, k] = [m[1], m[2]];
    if (!out.some((r) => r.z === z && r.k === k)) out.push({ z, k });
  }
  return out;
}

export function pickCurrentRange(ranges: RangeRef[], now: Date): RangeRef | null {
  const today = ymd(now);
  return ranges.find((r) => r.z <= today && today <= r.k) ?? null;
}

/** Rows: checkbox | Rozvrh | Období | Pracoviště | Forma | Začátek | Konec (real header). */
export function parseRozvrhRows(doc: Document, range: RangeRef): RozvrhRef[] {
  const out: RozvrhRef[] = [];
  for (const tr of Array.from(doc.querySelectorAll('tr'))) {
    const cb = tr.querySelector('input[name="rozvrh"]');
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => txt(td));
    if (!cb || cells.length < 7) continue;
    out.push({
      id: cb.getAttribute('value') ?? '',
      z: range.z,
      k: range.k,
      label: cells[1] ?? '',
      period: cells[2] ?? '',
      faculty: cells[3] ?? '',
      form: cells[4] ?? '',
      start: cells[5] ?? '',
      end: cells[6] ?? '',
    });
  }
  return out;
}

export function parseCriteria(doc: Document): { programmes: CriteriaProgramme[]; years: number[] } {
  const programmes: CriteriaProgramme[] = [];
  for (const o of Array.from(doc.querySelectorAll('select[name="program"] option'))) {
    const value = o.getAttribute('value') ?? '';
    if (!value || value === '0') continue;
    const [shortCode, ...rest] = txt(o).split(' ');
    if (!shortCode || !/^[A-Z]{1,3}-[A-Z0-9]+$/.test(shortCode)) continue;
    programmes.push({ programId: value, shortCode, name: rest.join(' ') });
  }
  const years = Array.from(doc.querySelectorAll('select[name="rocnik"] option'))
    .map((o) => Number(o.getAttribute('value')))
    .filter((n) => Number.isInteger(n) && n > 0);
  return { programmes, years };
}

/**
 * Study-group numbers of year `year`, from the `format=list` table's Omezení
 * column (the JSON has no group field). Located by header text, as reis-scraper
 * does: IS drops the column on timetables without groups. "1b-f2" → 2.
 */
export function parseGroupNumbers(doc: Document, year: number): number[] {
  const groups = new Set<number>();
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    const trs = Array.from(table.querySelectorAll('tr'));
    const headIdx = trs.findIndex((tr) => {
      const h = Array.from(tr.querySelectorAll('th,td')).map((c) => txt(c));
      return h.includes('Den') && h.includes('Omezení');
    });
    const head = trs[headIdx];
    if (!head) continue;
    const col = Array.from(head.querySelectorAll('th,td'))
      .map((c) => txt(c))
      .indexOf('Omezení');
    for (const tr of trs.slice(headIdx + 1)) {
      const m = /^(\d+)[a-z]*-[a-z]+(\d+)$/i.exec(txt(tr.querySelectorAll('td')[col]));
      if (m && Number(m[1]) === year) groups.add(Number(m[2]));
    }
  }
  return [...groups].sort((a, b) => a - b);
}
