import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  fetchImpersonation: vi.fn(),
  loadOptions: vi.fn(),
  loadYear1Groups: vi.fn(),
}));
vi.mock('../../../api/impersonation/fetchImpersonation', () => ({
  fetchImpersonation: (...a: unknown[]) => m.fetchImpersonation(...a),
}));
vi.mock('../../../api/impersonation/options', () => ({
  loadOptions: (...a: unknown[]) => m.loadOptions(...a),
  loadYear1Groups: (...a: unknown[]) => m.loadYear1Groups(...a),
}));
vi.mock('../../../services/admin/hasAdminSession', () => ({ hasAdminSession: async () => false }));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: { auth: { signOut: vi.fn(async () => ({ error: null })) } },
}));
// Exit re-runs loadContext: no IS here, so the admin's own record is "none".
vi.mock('../../../utils/userParams', async (orig) => ({
  ...(await orig<typeof import('../../../utils/userParams')>()),
  getUserParams: async () => null,
  isIdentityConfirmed: () => true,
}));

import { useAppStore } from '../../useAppStore';
import { overlayWrite } from '../../overlay/overlayGuard';
import { IndexedDBService } from '../../../services/storage';
import { ImpersonationError } from '../../../api/impersonation/types';
import * as setup from './personaSliceSetup';

const { ROZVRH, s, codes, cachedCode } = setup;
const { fetchImpersonation, loadOptions } = m;
const gatedFetch = (code: string) => setup.gatedFetch(m.fetchImpersonation, code);

/** Requests that overlap: Já, logout, refresh, picker (review 2026-11-27). */
beforeEach(() => setup.resetPersonaStore(m));

describe('persona races (review 2026-11-27)', () => {
  it('Já cancels a first fetch while nothing is active yet: cached, not applied', async () => {
    const release = gatedFetch('B-F-1');
    const pending = s().switchToPersona('finance');
    await vi.waitFor(() => expect(s().personaRows.finance).toBe('loading'));
    s().cancelPersonaSwitch();
    expect(s().personaRows.finance).toBeUndefined();
    release();
    expect(await pending).toBe(false);
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
  });

  it('admin logout during a fetch: nothing applied, nothing cached', async () => {
    const release = gatedFetch('B-F-1');
    const pending = s().switchToPersona('finance');
    await vi.waitFor(() => expect(s().personaRows.finance).toBe('loading'));
    await s().adminLogout();
    release();
    expect(await pending).toBe(false);
    expect(s().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('a refresh landing while Já is on its way out does not bring the persona back', async () => {
    await s().switchToPersona('finance');
    vi.setSystemTime(new Date(2026, 8, 28));
    const release = gatedFetch('B-F-2');
    await s().switchToPersona('finance');
    const leaving = s().stopImpersonation();
    release();
    await leaving;
    await vi.waitFor(async () => expect(await cachedCode('finance')).toBe('B-F-2'));
    expect(s().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'impersonation')).toBeUndefined();
  });

  it('a refresh leaves the picker alone (open drawer, a one-off starting)', async () => {
    await s().switchToPersona('finance');
    vi.setSystemTime(new Date(2026, 8, 28));
    const release = gatedFetch('B-F-2');
    await s().switchToPersona('finance');
    useAppStore.setState({ impersonationPickerOpen: true });
    release();
    await vi.waitFor(() => expect(codes()).toEqual(['B-F-2']));
    expect(s().impersonationPickerOpen).toBe(true);
  });

  it('an options failure says options, not timetable', async () => {
    loadOptions.mockRejectedValueOnce(new Error('network'));
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(s().personaRows.finance).toBe('options');
  });

  it('a failed background refresh marks the row, keeping the cached persona applied', async () => {
    await s().switchToPersona('finance');
    vi.setSystemTime(new Date(2026, 8, 28));
    fetchImpersonation.mockRejectedValueOnce(new ImpersonationError('timetable'));
    expect(await s().switchToPersona('finance')).toBe(true);
    await vi.waitFor(() => expect(s().personaRows.finance).toBe('timetable'));
    expect(s().impersonation?.selection.personaId).toBe('finance');
    expect(codes()).toEqual(['B-F-1']);
  });

  it('an expired saved persona at a boot with no admin session takes the cache too', async () => {
    await s().switchToPersona('finance');
    useAppStore.setState(overlayWrite({ impersonation: null, adminRole: null }));
    vi.setSystemTime(new Date(2027, 2, 1));
    await s().restoreImpersonation();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('Já during the boot restore wins over the saved persona', async () => {
    await s().switchToPersona('finance');
    useAppStore.setState(overlayWrite({ impersonation: null }));
    const restoring = s().restoreImpersonation();
    s().cancelPersonaSwitch();
    await restoring;
    expect(s().impersonation).toBeNull();
  });

  it('a failed save of the active impersonation leaves the switch undone, not thrown', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    const set = IndexedDBService.set.bind(IndexedDBService);
    const spy = vi
      .spyOn(IndexedDBService, 'set')
      .mockImplementation(async (store, key, value) =>
        key === 'impersonation'
          ? Promise.reject(new Error('quota'))
          : set(store, key, value as never)
      );
    await expect(s().switchToPersona('finance')).resolves.toBe(false);
    expect(s().impersonation).toBeNull();
    // Said on the row, unlike a cancel.
    expect(s().personaRows.finance).toBe('storage');
    spy.mockRestore();
  });

  it('closing the picker while a one-off starts cancels it', async () => {
    const release = gatedFetch('B-F-9');
    const starting = s().startImpersonation({
      programId: '2',
      shortCode: 'B-F',
      name: 'Finance',
      faculty: 'PEF',
      year: 1,
      group: 1,
      rozvrh: ROZVRH,
    });
    await vi.waitFor(() => expect(m.fetchImpersonation).toHaveBeenCalled());
    s().closeImpersonationPicker();
    expect(s().impersonationStarting).toBe(false);
    release();
    expect(await starting).toBe(false);
    expect(s().impersonation).toBeNull();
  });

  it('closing the picker cancels the latest one-off even after an older one ended', async () => {
    const req = {
      programId: '2',
      shortCode: 'B-F',
      name: 'Finance',
      faculty: 'PEF',
      year: 1,
      group: 1,
      rozvrh: ROZVRH,
    };
    const releaseA = gatedFetch('A-1');
    const a = s().startImpersonation(req);
    await vi.waitFor(() => expect(m.fetchImpersonation).toHaveBeenCalledTimes(1));
    s().closeImpersonationPicker();
    const releaseB = gatedFetch('B-1');
    const b = s().startImpersonation(req);
    await vi.waitFor(() => expect(m.fetchImpersonation).toHaveBeenCalledTimes(2));
    releaseA();
    expect(await a).toBe(false);
    // A ended under an older request: B's spinner is B's.
    expect(s().impersonationStarting).toBe(true);
    s().closeImpersonationPicker();
    releaseB();
    expect(await b).toBe(false);
    expect(s().impersonation).toBeNull();
  });

  it('an older fetch never touches the row of a newer one for the same persona', async () => {
    const releaseOld = gatedFetch('B-F-old');
    const old = s().switchToPersona('finance');
    await vi.waitFor(() => expect(s().personaRows.finance).toBe('loading'));
    s().cancelPersonaSwitch();
    const releaseNew = gatedFetch('B-F-new');
    const fresh = s().switchToPersona('finance');
    await vi.waitFor(() => expect(m.fetchImpersonation).toHaveBeenCalledTimes(2));
    releaseOld();
    expect(await old).toBe(false);
    expect(s().personaRows.finance).toBe('loading');
    releaseNew();
    expect(await fresh).toBe(true);
    expect(s().personaRows.finance).toBeUndefined();
  });

  it('a persona chosen while Já is still exiting wins over the exit', async () => {
    await s().switchToPersona('finance');
    await s().switchToPersona('it');
    const leaving = s().stopImpersonation();
    const chosen = s().switchToPersona('finance');
    await Promise.all([leaving, chosen]);
    expect(s().impersonation?.selection.personaId).toBe('finance');
    expect(codes()).toEqual(['B-F-1']);
  });
});
