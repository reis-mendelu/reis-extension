import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Points of a subject from an earlier semester. The sync skips those on
 * purpose (subjectScope), and for points nothing fetched them on open, so a
 * subject whose semester had ended before reIS first cached its points stayed
 * blank ("Počítačové sítě").
 */

const { fetchSubjectZaznamnik, idbSet } = vi.hoisted(() => ({
  fetchSubjectZaznamnik: vi.fn(),
  idbSet: vi.fn(async () => undefined),
}));
vi.mock('../../../api/zaznamnik', () => ({ fetchSubjectZaznamnik }));
vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: idbSet, getAllWithKeys: vi.fn() },
}));
vi.mock('../../../services/storage/IndexedDBService', () => ({
  INSTALL_ID_KEY: 'install_id',
  IndexedDBService: { get: vi.fn(async () => undefined), set: idbSet, getAllWithKeys: vi.fn() },
}));

import { useAppStore } from '../../useAppStore';

const LOADED = { ph: { sections: [{ arches: [] }] }, vt: { tests: [] } };

describe('loadPastZaznamnik', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      impersonation: null,
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      subjects: {
        data: {
          PS: { subjectId: '789', periodId: '300', hasPrubezne: true },
          EBC: { subjectId: '111', hasPrubezne: true },
        },
      },
      zaznamnik: {},
      zaznamnikLoading: {},
    } as never);
  });

  it("fetches a past subject's points for the period it was taken in, and keeps them", async () => {
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);

    await useAppStore.getState().loadPastZaznamnik('PS');

    expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '300', '789');
    expect(useAppStore.getState().zaznamnik['PS']).toEqual(LOADED);
    expect(idbSet).toHaveBeenCalledWith('zaznamnik', 'PS', LOADED);
  });

  it('leaves current-semester subjects to the sync', async () => {
    await useAppStore.getState().loadPastZaznamnik('EBC');
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
  });

  it('does not fetch again once the points are stored', async () => {
    useAppStore.setState({ zaznamnik: { PS: LOADED } } as never);
    await useAppStore.getState().loadPastZaznamnik('PS');
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
  });

  it('records a failure as failed (null), so the tab offers a retry instead of loading forever', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(null);
    await useAppStore.getState().loadPastZaznamnik('PS');
    expect(useAppStore.getState().zaznamnik['PS']).toBeNull();
    expect(useAppStore.getState().zaznamnikLoading['PS']).toBe(false);
  });

  it('records a throw as failed too', async () => {
    fetchSubjectZaznamnik.mockRejectedValue(new Error('offline'));
    await useAppStore.getState().loadPastZaznamnik('PS');
    expect(useAppStore.getState().zaznamnik['PS']).toBeNull();
  });

  it('stores an empty answer without persisting it, so the next launch asks IS again', async () => {
    fetchSubjectZaznamnik.mockResolvedValue({ ph: { sections: [] }, vt: { tests: [] } });
    await useAppStore.getState().loadPastZaznamnik('PS');
    expect(useAppStore.getState().zaznamnik['PS']).toBeDefined();
    expect(idbSet).not.toHaveBeenCalled();
  });

  it("the drawer's retry also asks the subject's own period", async () => {
    useAppStore.setState({ zaznamnik: { PS: null } } as never);
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);

    await useAppStore.getState().refetchZaznamnik('PS');

    expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '300', '789');
  });

  it('starts when a phone subject drawer opens, by the action that opens it', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);

    useAppStore.getState().pushSheet({ kind: 'subjectDrawer', courseCode: 'PS' });

    await vi.waitFor(() => expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '300', '789'));
    expect(useAppStore.getState().zaznamnikLoading['PS']).toBeDefined();
  });

  it('does not start for other sheets', () => {
    useAppStore.getState().pushSheet({ kind: 'studyPlan' });
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
  });
});

// The drawer opens before its inputs exist (a notification on a cold start):
// the request is remembered and started when the store has what it needs.
describe('loadPastZaznamnik opened too early', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      impersonation: null,
      studiumId: null,
      obdobiId: null,
      zaznamnikHydrated: false,
      subjects: null,
      zaznamnik: {},
      zaznamnikLoading: {},
      pendingPastZaznamnik: {},
    } as never);
  });

  const PAST = { subjectId: '789', periodId: '300', hasPrubezne: true };

  it('fetches once hydration and the subject list have arrived', async () => {
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);
    await useAppStore.getState().loadPastZaznamnik('PS');
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();

    // Hydration, the ids and the subjects land one after the other.
    useAppStore.setState({ zaznamnikHydrated: true } as never);
    useAppStore.setState({ studiumId: '123', obdobiId: '456' } as never);
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
    useAppStore.setState({ subjects: { data: { PS: PAST } } } as never);

    await vi.waitFor(() => expect(useAppStore.getState().zaznamnik['PS']).toEqual(LOADED));
    expect(fetchSubjectZaznamnik).toHaveBeenCalledTimes(1);
    expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '300', '789');
    expect(useAppStore.getState().pendingPastZaznamnik).toEqual({});
  });

  it('drops the request when the subject turns out to be a current one', async () => {
    await useAppStore.getState().loadPastZaznamnik('EBC');
    useAppStore.setState({
      zaznamnikHydrated: true,
      studiumId: '123',
      obdobiId: '456',
      subjects: { data: { EBC: { subjectId: '111', periodId: '456', hasPrubezne: true } } },
    } as never);
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
    expect(useAppStore.getState().pendingPastZaznamnik).toEqual({});
  });

  it('keeps waiting for the periodId of a subject a sync has not folded in yet', async () => {
    useAppStore.setState({
      zaznamnikHydrated: true,
      studiumId: '123',
      obdobiId: '456',
      subjects: { data: { PS: { subjectId: '789', hasPrubezne: true } } },
    } as never);
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);
    await useAppStore.getState().loadPastZaznamnik('PS');
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
    expect(useAppStore.getState().pendingPastZaznamnik).toEqual({ PS: true });
    // The next sync stores it with the period it was taken in.
    useAppStore.setState({ subjects: { data: { PS: PAST } } } as never);
    await vi.waitFor(() => expect(fetchSubjectZaznamnik).toHaveBeenCalledWith('123', '300', '789'));
  });

  it('keeps waiting while the subject itself has not arrived', async () => {
    await useAppStore.getState().loadPastZaznamnik('PS');
    useAppStore.setState({
      zaznamnikHydrated: true,
      studiumId: '123',
      obdobiId: '456',
      subjects: { data: {} },
    } as never);
    expect(fetchSubjectZaznamnik).not.toHaveBeenCalled();
    expect(useAppStore.getState().pendingPastZaznamnik).toEqual({ PS: true });
    // The sync folds the past semester in and the subject list is reloaded.
    fetchSubjectZaznamnik.mockResolvedValue(LOADED);
    useAppStore.setState({ subjects: { data: { PS: PAST } } } as never);
    await vi.waitFor(() => expect(fetchSubjectZaznamnik).toHaveBeenCalledTimes(1));
  });
});
