import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `fetchDualLanguageSchedule` answers `null` for a failed read (either
 * language), and a failure is not "this student has no lessons". Deleting the
 * stored timetable on it would blank a good copy over one flaky request.
 */
const fetchDualLanguageSchedule = vi.fn();
vi.mock('../../../api/schedule', () => ({
  fetchDualLanguageSchedule: (...a: unknown[]) => fetchDualLanguageSchedule(...a),
}));
const set = vi.fn();
const del = vi.fn();
vi.mock('../../storage', () => ({
  IndexedDBService: { set: (...a: unknown[]) => set(...a), delete: (...a: unknown[]) => del(...a) },
}));

import { syncSchedule } from '../syncSchedule';

describe('syncSchedule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves the stored timetable alone when the fetch failed', async () => {
    fetchDualLanguageSchedule.mockResolvedValue(null);
    await syncSchedule();
    expect(del).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('still clears it for a successful empty answer', async () => {
    fetchDualLanguageSchedule.mockResolvedValue([]);
    await syncSchedule();
    expect(del).toHaveBeenCalledWith('schedule', 'current');
  });
});
