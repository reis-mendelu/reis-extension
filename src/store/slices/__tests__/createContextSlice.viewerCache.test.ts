import { describe, it, expect, vi, beforeEach } from 'vitest';

const { idb, getUserParams } = vi.hoisted(() => ({
  idb: new Map<string, unknown>(),
  getUserParams: vi.fn(),
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
vi.mock('../../../utils/userParams', () => ({ getUserParams }));

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
    useAppStore.setState({
      userFaculty: null,
      isErasmus: false,
      demoMode: false,
      contextResolved: false,
    });
  });

  it('remembers faculty and Erasmus once IS names them', async () => {
    getUserParams.mockResolvedValue({ facultyLabel: 'AF', isErasmus: true });
    await useAppStore.getState().loadContext();
    expect(idb.get('viewer_audience')).toEqual({ faculty: 'AF', erasmus: true });
    expect(useAppStore.getState().contextResolved).toBe(true);
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
});
