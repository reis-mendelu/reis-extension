/**
 * The semester window is computed from the wall clock, so the only way a wrong
 * window shows up is a student opening reIS in the wrong month and seeing an
 * empty or stale timetable. Each branch is pinned to a date inside it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchDualLanguageSchedule = vi.hoisted(() => vi.fn());
const set = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());

vi.mock('../../api/schedule', () => ({ fetchDualLanguageSchedule }));
vi.mock('../storage', () => ({
  IndexedDBService: { set, delete: del },
}));

import { syncSchedule } from './syncSchedule';

/** The {start,end} the single fetch call was given, as YYYY-MM-DD pairs. */
function windowPassed() {
  expect(fetchDualLanguageSchedule).toHaveBeenCalledTimes(1);
  const arg = fetchDualLanguageSchedule.mock.calls[0]![0] as { start: Date; end: Date };
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: iso(arg.start), end: iso(arg.end) };
}

describe('syncSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    fetchDualLanguageSchedule.mockResolvedValue([{ id: 1 }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('semester window', () => {
    it('spans Sep 1 to Aug 31 of the NEXT year during the winter semester', async () => {
      vi.setSystemTime(new Date(2026, 9, 15)); // 15 Oct 2026
      await syncSchedule();
      expect(windowPassed()).toEqual({ start: '2026-09-01', end: '2027-08-31' });
    });

    it('reaches back to the PREVIOUS September in the Jan/Feb transition', async () => {
      // January still belongs to the winter semester that began last September,
      // so anchoring to the current year would drop the whole first half of it.
      vi.setSystemTime(new Date(2026, 0, 20)); // 20 Jan 2026
      await syncSchedule();
      expect(windowPassed()).toEqual({ start: '2025-09-01', end: '2026-08-31' });
    });

    it('spans Feb 1 to Aug 31 of the same year during the summer semester', async () => {
      vi.setSystemTime(new Date(2026, 3, 10)); // 10 Apr 2026
      await syncSchedule();
      expect(windowPassed()).toEqual({ start: '2026-02-01', end: '2026-08-31' });
    });

    it('treats February as the transition, not the summer semester', async () => {
      // Feb is the boundary the two rules disagree on: month <= 1 wins, so Feb
      // keeps the previous September rather than starting a fresh Feb 1 window.
      vi.setSystemTime(new Date(2026, 1, 14)); // 14 Feb 2026
      await syncSchedule();
      expect(windowPassed()).toEqual({ start: '2025-09-01', end: '2026-08-31' });
    });

    it('treats September 1 as already winter', async () => {
      vi.setSystemTime(new Date(2026, 8, 1)); // 1 Sep 2026
      await syncSchedule();
      expect(windowPassed()).toEqual({ start: '2026-09-01', end: '2027-08-31' });
    });
  });

  describe('persistence', () => {
    it('stores the schedule when the fetch returns rows', async () => {
      vi.setSystemTime(new Date(2026, 3, 10));
      const rows = [{ id: 'lesson-1' }];
      fetchDualLanguageSchedule.mockResolvedValue(rows);

      await syncSchedule();

      expect(set).toHaveBeenCalledWith('schedule', 'current', rows);
      expect(del).not.toHaveBeenCalled();
    });

    it('DELETES the cached schedule when the fetch comes back empty', async () => {
      // Leaving the old rows in place would show last semester's timetable as if
      // it were current -- worse than showing nothing.
      vi.setSystemTime(new Date(2026, 3, 10));
      fetchDualLanguageSchedule.mockResolvedValue([]);

      await syncSchedule();

      expect(del).toHaveBeenCalledWith('schedule', 'current');
      expect(set).not.toHaveBeenCalled();
    });

    it('deletes rather than writes when the fetch resolves null', async () => {
      vi.setSystemTime(new Date(2026, 3, 10));
      fetchDualLanguageSchedule.mockResolvedValue(null);

      await syncSchedule();

      expect(del).toHaveBeenCalledWith('schedule', 'current');
      expect(set).not.toHaveBeenCalled();
    });
  });
});
