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
