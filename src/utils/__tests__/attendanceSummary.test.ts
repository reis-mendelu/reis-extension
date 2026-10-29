import { describe, expect, it } from 'vitest';
import {
  czFromPreposition,
  shortDate,
  dashRange,
  groupDetail,
  summarizeAttendance,
} from '../attendanceSummary';
import type { AttendanceRecord, AttendanceStatus } from '../../types/documents';

const rec = (status: AttendanceStatus): AttendanceRecord => ({
  date: '20. 10. 2026',
  time: '13.00-14.50',
  room: 'Q05',
  status,
});

describe('summarizeAttendance', () => {
  it('counts being there, in any form, as attended', () => {
    const s = summarizeAttendance(
      ['present', 'elsewhere', 'late', 'early-leave'].map((x) => rec(x as AttendanceStatus))
    );
    expect(s).toEqual({ attended: 4, counted: 4, absent: 0 });
  });

  it('counts an absence against the total', () => {
    expect(summarizeAttendance([rec('present'), rec('absent')])).toEqual({
      attended: 1,
      counted: 2,
      absent: 1,
    });
  });

  it('leaves excused and excluded sessions out of the total', () => {
    expect(summarizeAttendance([rec('present'), rec('excused'), rec('excluded')])).toEqual({
      attended: 1,
      counted: 1,
      absent: 0,
    });
  });
});

describe('czFromPreposition', () => {
  // "ze" before a number whose Czech word starts with s/z/š/ž or a hard cluster.
  it.each([
    [1, 'z'],
    [2, 'ze'],
    [3, 'ze'],
    [4, 'ze'],
    [5, 'z'],
    [6, 'ze'],
    [7, 'ze'],
    [8, 'z'],
    [9, 'z'],
    [10, 'z'],
    [11, 'z'],
    [12, 'ze'],
    [13, 'ze'],
    [14, 'ze'],
    [15, 'z'],
    [16, 'ze'],
    [17, 'ze'],
    [20, 'ze'],
    [25, 'ze'],
    [31, 'ze'],
    [52, 'z'],
    [100, 'ze'],
  ])('%i takes "%s"', (n, expected) => {
    expect(czFromPreposition(n)).toBe(expected);
  });
});

describe('formatting', () => {
  it('drops the year from an IS date', () => {
    expect(shortDate('20. 10. 2026')).toBe('20. 10.');
    expect(shortDate('6. 10.')).toBe('6. 10.');
  });

  it('writes a time range with an en dash', () => {
    expect(dashRange('13.00-14.50')).toBe('13.00–14.50');
  });

  it('drops the course code from a group label', () => {
    expect(groupDetail('EBC-M Cv Út 13.00-14.50 Q05', 'EBC-M')).toBe('Cv Út 13.00–14.50 Q05');
    expect(groupDetail('Cv Út 13.00-14.50', 'EBC-M')).toBe('Cv Út 13.00–14.50');
  });
});
