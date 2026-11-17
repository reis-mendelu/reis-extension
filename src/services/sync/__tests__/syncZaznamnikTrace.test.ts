import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearDiagnostics, getDiagnostics } from '../../../utils/diagnostics/diagnosticLog';
import { resetSyncTraces } from '../../../utils/diagnostics/syncTrace';

/**
 * A "Zápisník is empty" report needs to say whether IS answered empty or the
 * fetch failed. Per-subject failures were swallowed with a bare catch, so the
 * log had neither. Counts only — never which subject.
 */
const fetchSubjectZaznamnik = vi.fn();
vi.mock('../../../api/zaznamnik', () => ({
  fetchSubjectZaznamnik: (...a: unknown[]) => fetchSubjectZaznamnik(...a),
}));
vi.mock('../../storage/IndexedDBService', () => ({ IndexedDBService: { set: vi.fn() } }));

const { syncZaznamnik } = await import('../syncZaznamnik');

const input = (code: string) => ({ courseCode: code, subjectId: code, hasPrubezne: true });
const empty = { ph: { sections: [] }, vt: { tests: [] } };
const full = { ph: { sections: [{}] }, vt: { tests: [] } };

describe('syncZaznamnik leaves a trace when a page is empty or failed', () => {
  beforeEach(() => {
    clearDiagnostics();
    resetSyncTraces();
    fetchSubjectZaznamnik.mockReset();
  });

  it('counts asked, failed and empty pages in one line', async () => {
    fetchSubjectZaznamnik
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('boom'));
    await syncZaznamnik('s', 'o', ['XX1', 'XX2', 'XX3', 'XX4'].map(input));

    const lines = getDiagnostics().filter((e) => e.ctx === 'Sync.zaznamnik');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.level).toBe('warn');
    expect(lines[0]!.msg).toBe('4 asked, 2 failed, 1 empty');
  });

  it('says nothing when every page had something', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(full);
    await syncZaznamnik('s', 'o', ['XX1', 'XX2'].map(input));
    expect(getDiagnostics()).toEqual([]);
  });
});
