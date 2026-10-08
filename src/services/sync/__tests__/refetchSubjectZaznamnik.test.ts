import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The drawer's Záznamník retry fetches one subject; persisting what it got is
 * the sync layer's job (services/sync is the only writer to persistent state),
 * so the store slice calls this rather than IndexedDB.
 */

const { fetchSubjectZaznamnik, idbSet } = vi.hoisted(() => ({
  fetchSubjectZaznamnik: vi.fn(),
  idbSet: vi.fn(async () => undefined),
}));
vi.mock('../../../api/zaznamnik', () => ({ fetchSubjectZaznamnik }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../../storage/IndexedDBService', () => ({ IndexedDBService: { set: idbSet } }));

import { refetchSubjectZaznamnik, syncZaznamnik } from '../syncZaznamnik';

const LOADED = { ph: { sections: [{ arches: [] }] }, vt: { tests: [] } };
const EMPTY = { ph: { sections: [] }, vt: { tests: [] } };

describe('refetchSubjectZaznamnik', () => {
  beforeEach(() => vi.resetAllMocks());

  it('fetches one subject and persists real records', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);

    const out = await refetchSubjectZaznamnik('123', '456', 'EBC', '789');

    expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '456', '789');
    expect(out).toEqual(LOADED);
    expect(idbSet).toHaveBeenCalledWith('zaznamnik', 'EBC', LOADED);
  });

  it('persists neither a failure nor an empty page — the same rule as the sync', async () => {
    fetchSubjectZaznamnik.mockResolvedValueOnce(null).mockResolvedValueOnce(EMPTY);

    expect(await refetchSubjectZaznamnik('123', '456', 'EBC', '789')).toBeNull();
    expect(await refetchSubjectZaznamnik('123', '456', 'EBC', '789')).toEqual(EMPTY);
    expect(idbSet).not.toHaveBeenCalled();
  });

  it('shows what it fetched even when saving it fails', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);
    idbSet.mockRejectedValue(new Error('QuotaExceededError'));

    await expect(refetchSubjectZaznamnik('123', '456', 'EBC', '789')).resolves.toEqual(LOADED);
  });

  it("shares the sync's two-subject cap, so a retry during a sync waits its turn", async () => {
    const releases: ((v: unknown) => void)[] = [];
    fetchSubjectZaznamnik.mockImplementation(() => new Promise((r) => releases.push(r)));

    const sync = syncZaznamnik('123', '456', [
      { courseCode: 'A', subjectId: '1', hasPrubezne: true },
      { courseCode: 'B', subjectId: '2', hasPrubezne: true },
    ]);
    const retry = refetchSubjectZaznamnik('123', '456', 'EBC', '789');
    await vi.waitFor(() => expect(fetchSubjectZaznamnik).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSubjectZaznamnik).toHaveBeenCalledTimes(2);

    releases.forEach((r) => r(null));
    await vi.waitFor(() => expect(fetchSubjectZaznamnik).toHaveBeenCalledTimes(3));
    releases[2]!(LOADED);
    await Promise.all([sync, retry]);
  });
});
