import { describe, it, expect, vi, beforeEach } from 'vitest';

const { idb, getUserParams, isIdentityConfirmed } = vi.hoisted(() => ({
  idb: new Map<string, unknown>(),
  getUserParams: vi.fn(),
  isIdentityConfirmed: vi.fn(() => true),
}));
vi.mock('../../../services/storage', async (orig) => {
  const real = await orig<typeof import('../../../services/storage')>();
  return {
    ...real,
    IndexedDBService: {
      ...real.IndexedDBService,
      get: vi.fn(async (_s: string, k: string) => idb.get(k)),
      set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
    },
  };
});
vi.mock('../../../utils/userParams', () => ({ getUserParams, isIdentityConfirmed }));

import { useAppStore } from '../../useAppStore';

/**
 * The event audience rule reads the student's faculty. On Capacitor,
 * getUserParams can lose the race with session restore at boot, which would
 * leave the faculty unknown — public events only — for the whole session.
 * Follows used to be persisted, which hid that; this cache replaces them.
 */
describe('loadContext viewer cache', () => {
  beforeEach(() => {
    idb.clear();
    getUserParams.mockReset();
    isIdentityConfirmed.mockReturnValue(true);
    useAppStore.setState({
      userFaculty: null,
      userProgramme: null,
      isErasmus: false,
      demoMode: false,
      contextResolved: false,
    });
  });

  it('remembers faculty and Erasmus once IS names them', async () => {
    getUserParams.mockResolvedValue({ facultyLabel: 'AF', isErasmus: true });
    await useAppStore.getState().loadContext();
    expect(idb.get('viewer_audience')).toMatchObject({ faculty: 'AF', erasmus: true });
    expect((idb.get('viewer_audience') as { savedAt: number }).savedAt).toBeGreaterThan(0);
    expect(useAppStore.getState().contextResolved).toBe(true);
  });

  it('stores the base programme and caches it with the faculty (spec 2026-10-09)', async () => {
    getUserParams.mockResolvedValue({ facultyLabel: 'PEF', studyProgram: 'B-OI-ZBOI', isErasmus: false });
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().userProgramme).toBe('B-OI');
    expect(idb.get('viewer_audience')).toMatchObject({ faculty: 'PEF', programme: 'B-OI' });
  });

  it('restores the cached programme on a cold start', async () => {
    idb.set('viewer_audience', { faculty: 'PEF', erasmus: false, programme: 'B-OI' });
    getUserParams.mockResolvedValue(null);
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().userProgramme).toBe('B-OI');
  });

  it('falls back to the remembered audience when IS has not answered (cold start)', async () => {
    idb.set('viewer_audience', { faculty: 'ZF', erasmus: false });
    getUserParams.mockResolvedValue(null);
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().userFaculty).toBe('ZF');
    expect(useAppStore.getState().contextResolved).toBe(false);
  });

  it('does not overwrite a known faculty with an unparsed one', async () => {
    idb.set('viewer_audience', { faculty: 'ZF', erasmus: false });
    getUserParams.mockResolvedValue({ facultyLabel: undefined, isErasmus: false });
    await useAppStore.getState().loadContext();
    expect(idb.get('viewer_audience')).toEqual({ faculty: 'ZF', erasmus: false });
    expect(useAppStore.getState().userFaculty).toBe('ZF');
  });

  it('a persisted answer IS has not confirmed does not count as resolved', async () => {
    isIdentityConfirmed.mockReturnValue(false);
    getUserParams.mockResolvedValue({ facultyLabel: 'AF', isErasmus: false });
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().userFaculty).toBe('AF');
    expect(useAppStore.getState().contextResolved).toBe(false);
  });

  it('still asks IS when the cache cannot be read', async () => {
    idb.set('viewer_audience', 'boom');
    const { IndexedDBService } = await import('../../../services/storage');
    vi.mocked(IndexedDBService.get).mockRejectedValueOnce(new Error('idb'));
    getUserParams.mockResolvedValue({ facultyLabel: 'ZF', isErasmus: false });
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().userFaculty).toBe('ZF');
  });

  it('trusts a remembered Erasmus status only while it is recent', async () => {
    const old = Date.now() - 200 * 24 * 60 * 60 * 1000;
    idb.set('viewer_audience', { faculty: 'PEF', erasmus: true, savedAt: old });
    getUserParams.mockResolvedValue(null);
    await useAppStore.getState().loadContext();
    expect(useAppStore.getState().userFaculty).toBe('PEF');
    expect(useAppStore.getState().isErasmus).toBe(false);
  });
});
