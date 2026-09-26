import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseRanges,
  pickCurrentRange,
  parseRozvrhRows,
  parseCriteria,
  parseGroupNumbers,
} from '../timetableForm';
import { parseDoc } from '../text';

const fx = (n: string) =>
  parseDoc(
    readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures', n), 'utf8')
  );

describe('timetable app pages (real, trimmed, 2026-09-26)', () => {
  it('lists validity ranges and picks the one containing today', () => {
    const ranges = parseRanges(fx('rozvrh-index.html'));
    expect(ranges).toContainEqual({ z: '20260921', k: '20261213' });
    expect(pickCurrentRange(ranges, new Date(2026, 8, 26))).toEqual({
      z: '20260921',
      k: '20261213',
    });
    expect(pickCurrentRange(ranges, new Date(2027, 5, 1))).toBeNull();
  });
  it('reads rozvrh rows with faculty, form and validity', () => {
    const rows = parseRozvrhRows(fx('rozvrh-range.html'), { z: '20260921', k: '20261213' });
    const pef = rows.find((r) => r.id === '5769')!;
    expect(pef).toMatchObject({
      faculty: 'PEF',
      form: 'prezenční',
      period: 'ZS 2026/2027',
      start: '21.09.2026',
      end: '20.12.2026',
      z: '20260921',
      k: '20261213',
    });
    expect(rows.find((r) => r.id === '5770')?.form).toBe('kombinovaná');
  });
  it('reads programmes and years from the criteria form', () => {
    const form = parseCriteria(fx('rozvrh-criteria.html'));
    expect(form.programmes).toContainEqual({
      programId: '1889',
      shortCode: 'B-F',
      name: 'Finance',
    });
    expect(form.years).toEqual([1, 2, 3]);
  });
  it('reads year-1 study groups from the list format Omezení column', () => {
    // Real labels: 1b-f (lecture, no group) and 1b-f1 … 1b-f5.
    expect(parseGroupNumbers(fx('rozvrh-list-bf-y1.html'), 1)).toEqual([1, 2, 3, 4, 5]);
    expect(parseGroupNumbers(fx('rozvrh-list-bf-y1.html'), 2)).toEqual([]);
  });
  it('expands the ranged and listed labels ZF uses (real B-CHP year 1, 2026-09-26)', () => {
    // 1b-chp1-3, 1b-chp5,6, 1b-chp1,2,6 … and a real group 99 (it is in IS's own
    // skupina select). Reading only "1b-chp<N>" gave [1, 99], and the picker offered 99.
    expect(parseGroupNumbers(fx('rozvrh-list-zf-chp-y1.html'), 1)).toEqual([1, 2, 3, 4, 5, 6, 99]);
  });
});
