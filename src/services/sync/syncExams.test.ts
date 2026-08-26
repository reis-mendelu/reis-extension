/**
 * syncExams is write-only-on-success by design: an empty fetch must leave the
 * cached exams alone. Losing them would empty the exam panel during the exam
 * season, which is exactly when a transient IS hiccup is most likely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const set = vi.hoisted(() => vi.fn());
const fetchDualLanguageExams = vi.hoisted(() => vi.fn());

vi.mock('../storage', () => ({ IndexedDBService: { set } }));
vi.mock('../../api/exams', () => ({ fetchDualLanguageExams }));

import { syncExams } from './syncExams';

describe('syncExams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores the exams when the fetch returns rows', async () => {
    const rows = [{ id: 'term-1' }];
    fetchDualLanguageExams.mockResolvedValue(rows);

    await syncExams();

    expect(set).toHaveBeenCalledWith('exams', 'current', rows);
  });

  it('leaves the cache untouched on an empty result', async () => {
    fetchDualLanguageExams.mockResolvedValue([]);
    await syncExams();
    expect(set).not.toHaveBeenCalled();
  });

  it('leaves the cache untouched on a null result', async () => {
    fetchDualLanguageExams.mockResolvedValue(null);
    await syncExams();
    expect(set).not.toHaveBeenCalled();
  });

  it('propagates a fetch rejection to the orchestrator', async () => {
    // The step deliberately does not catch: SyncService decides what a failed
    // step means for the run, and swallowing it here would report a clean sync.
    fetchDualLanguageExams.mockRejectedValue(new Error('IS down'));
    await expect(syncExams()).rejects.toThrow('IS down');
    expect(set).not.toHaveBeenCalled();
  });
});
