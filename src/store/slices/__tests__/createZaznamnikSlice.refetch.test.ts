import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The drawer's retry for a failed Záznamník. Before Návrhy #26 there was no
 * on-demand path: the only fetch was the sync's, so a subject whose fetch
 * failed stayed failed until the next full run.
 */

const { fetchSubjectZaznamnik, idbSet } = vi.hoisted(() => ({
  fetchSubjectZaznamnik: vi.fn(),
  idbSet: vi.fn(async () => undefined),
}));
vi.mock('../../../api/zaznamnik', () => ({ fetchSubjectZaznamnik }));
vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: idbSet, getAllWithKeys: vi.fn() },
}));
// The retry persists through services/sync, which imports the file directly.
vi.mock('../../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: idbSet, getAllWithKeys: vi.fn() },
}));

import { useAppStore } from '../../useAppStore';

const LOADED = { ph: { sections: [{ arches: [] }] }, vt: { tests: [] } };

describe('refetchZaznamnik', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      impersonation: null,
      studiumId: '123',
      obdobiId: '456',
      subjects: { data: { EBC: { subjectId: '789', hasPrubezne: true } } },
      zaznamnik: { EBC: null },
      zaznamnikLoading: {},
    } as never);
  });

  it("fetches the subject's records and stores them", async () => {
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);

    await useAppStore.getState().refetchZaznamnik('EBC');

    expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '456', '789');
    expect(useAppStore.getState().zaznamnik['EBC']).toEqual(LOADED);
    expect(useAppStore.getState().zaznamnikLoading['EBC']).toBe(false);
    expect(idbSet).toHaveBeenCalledWith('zaznamnik', 'EBC', LOADED);
  });

  it('is loading while in flight', async () => {
    let release: (v: unknown) => void = () => {};
    fetchSubjectZaznamnik.mockReturnValue(new Promise((r) => (release = r)));

    const pending = useAppStore.getState().refetchZaznamnik('EBC');
    expect(useAppStore.getState().zaznamnikLoading['EBC']).toBe(true);

    release(null);
    await pending;
    expect(useAppStore.getState().zaznamnikLoading['EBC']).toBe(false);
  });

  it('leaves the failure in place when the retry fails too', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(null);

    await useAppStore.getState().refetchZaznamnik('EBC');

    expect(useAppStore.getState().zaznamnik['EBC']).toBeNull();
  });

  it('never fetches while impersonating another programme', async () => {
    useAppStore.setState({ impersonation: { programme: 'x' } } as never);

    await useAppStore.getState().refetchZaznamnik('EBC');

    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
  });

  it('ignores a second retry while one is in flight', async () => {
    let release: (v: unknown) => void = () => {};
    fetchSubjectZaznamnik.mockReturnValue(new Promise((r) => (release = r)));

    const first = useAppStore.getState().refetchZaznamnik('EBC');
    await useAppStore.getState().refetchZaznamnik('EBC');
    await vi.waitFor(() => expect(fetchSubjectZaznamnik).toHaveBeenCalled());
    release(LOADED);
    await first;

    expect(fetchSubjectZaznamnik).toHaveBeenCalledTimes(1);
  });

  it('keeps cached records when the retry fails', async () => {
    useAppStore.setState({ zaznamnik: { EBC: LOADED } } as never);
    fetchSubjectZaznamnik.mockResolvedValue(null);

    await useAppStore.getState().refetchZaznamnik('EBC');

    expect(useAppStore.getState().zaznamnik['EBC']).toEqual(LOADED);
    expect(idbSet).not.toHaveBeenCalled();
  });
});
