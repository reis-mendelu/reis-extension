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
import type { ImpersonationResult, ImpersonationSelection } from '../../../api/impersonation/types';
import * as setup from './personaSliceSetup';

const { resultFor, s, codes, settle } = setup;
const { fetchImpersonation, loadOptions, loadYear1Groups } = m;

/** The one-tap persona switch (design 2026-11-27 §3, step B). */
beforeEach(() => setup.resetPersonaStore(m));

describe('persona switch', () => {
  it('a first switch fetches with the first IS group, applies, caches and survives restart', async () => {
    expect(await s().switchToPersona('finance')).toBe(true);
    expect(fetchImpersonation).toHaveBeenCalledOnce();
    expect(fetchImpersonation.mock.calls[0]![0]).toMatchObject({ shortCode: 'B-F', group: 4 });
    expect(codes()).toEqual(['B-F-1']);
    expect(s().impersonation?.selection.personaId).toBe('finance');
    expect(s().userProgramme).toBe('B-F');
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeDefined();
    expect(s().personaRows.finance).toBeUndefined();

    useAppStore.setState(overlayWrite({ impersonation: null }));
    await s().restoreImpersonation();
    expect(s().impersonation?.selection.personaId).toBe('finance');
  });

  it('a cached switch applies with no fetch at all', async () => {
    await s().switchToPersona('finance');
    await s().switchToPersona('it');
    fetchImpersonation.mockClear();
    loadOptions.mockClear();
    loadYear1Groups.mockClear();
    expect(await s().switchToPersona('finance')).toBe(true);
    expect(codes()).toEqual(['B-F-1']);
    expect(fetchImpersonation).not.toHaveBeenCalled();
    expect(loadOptions).not.toHaveBeenCalled();
    expect(loadYear1Groups).not.toHaveBeenCalled();
  });

  it('older than 24 h: applies the cache, then exactly one background fetch re-applies it', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    vi.setSystemTime(new Date(2026, 8, 27, 13));
    fetchImpersonation.mockClear();
    fetchImpersonation.mockImplementation(async (sel: ImpersonationSelection) =>
      resultFor(sel, 'B-F-2')
    );
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
      await gate;
      return resultFor(sel, 'B-F-2');
    });

    expect(await s().switchToPersona('finance')).toBe(true);
    expect(codes()).toEqual(['B-F-1']); // the cache, at once
    await s().switchToPersona('finance'); // a second tap while the refresh runs
    release();
    await settle();
    expect(fetchImpersonation).toHaveBeenCalledOnce();
    expect(codes()).toEqual(['B-F-2']);
    const saved = (await IndexedDBService.get('meta', 'persona:finance')) as {
      result: ImpersonationResult;
    };
    expect(saved.result.schedule[0]!.courseCode).toBe('B-F-2');
  });

  it('a background refresh does not re-apply once the admin moved on', async () => {
    await s().switchToPersona('finance');
    vi.setSystemTime(new Date(2026, 8, 28));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
      await gate;
      return resultFor(sel, 'B-F-2');
    });
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    release();
    await settle();
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
  });

  it('a failed fetch keeps the current identity and marks only that row', async () => {
    await s().switchToPersona('it');
    fetchImpersonation.mockRejectedValueOnce(new ImpersonationError('timetable'));
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(s().impersonation?.selection.personaId).toBe('it');
    expect(codes()).toEqual(['B-OI-1']);
    expect(s().userProgramme).toBe('B-OI');
    expect(s().personaRows).toEqual({ finance: 'timetable' });
    expect(s().impersonationError).toBeNull();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('an unresolved code fails its row without fetching', async () => {
    loadOptions.mockResolvedValue([]);
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(s().personaRows.finance).toBe('noPlan');
    expect(fetchImpersonation).not.toHaveBeenCalled();
  });

  it('a fetch that lands after "Já" is cached but not applied', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fetchImpersonation.mockImplementationOnce(async (sel: ImpersonationSelection) => {
      await gate;
      return resultFor(sel, 'B-F-1');
    });
    const pending = s().switchToPersona('finance');
    await vi.waitFor(() => expect(s().personaRows.finance).toBe('loading'));
    await s().stopImpersonation();
    release();
    expect(await pending).toBe(false);
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeDefined();
  });

  it('is for reis_admin only', async () => {
    useAppStore.setState({ adminRole: 'association' });
    expect(await s().switchToPersona('finance')).toBe(false);
    expect(fetchImpersonation).not.toHaveBeenCalled();
    expect(s().impersonation).toBeNull();
  });

  it('drops a cached persona from another period and fetches again', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    vi.setSystemTime(new Date(2027, 2, 1));
    fetchImpersonation.mockClear();
    await s().switchToPersona('finance');
    expect(fetchImpersonation).toHaveBeenCalledOnce();
  });
});
