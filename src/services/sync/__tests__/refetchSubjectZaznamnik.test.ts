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
vi.mock('../../storage/IndexedDBService', () => ({ IndexedDBService: { set: idbSet } }));

import { refetchSubjectZaznamnik } from '../syncZaznamnik';

const LOADED = { ph: { sections: [{ arches: [] }] }, vt: { tests: [] } };
const EMPTY = { ph: { sections: [] }, vt: { tests: [] } };

describe('refetchSubjectZaznamnik', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
