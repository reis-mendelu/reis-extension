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
import type { ImpersonationSelection } from '../../../api/impersonation/types';
import * as setup from './personaSliceSetup';

const { s, codes, resultFor } = setup;

/** When the persona cache is kept and when it goes (design §3). */
beforeEach(() => setup.resetPersonaStore(m));

describe('persona cache lifetime', () => {
  it('"Já" exits and keeps the cache', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    expect(s().impersonation).toBeNull();
    expect(codes()).toEqual(['REAL-1']);
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeDefined();
  });

  it('admin logout clears every persona, active or not', async () => {
    await s().switchToPersona('finance');
    await s().switchToPersona('it');
    await s().adminLogout();
    expect(s().impersonation).toBeNull();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
    expect(await IndexedDBService.get('meta', 'persona:it')).toBeUndefined();
  });

  it('IS logout and an identity change (clearAll) take the persona cache with them', async () => {
    await s().switchToPersona('finance');
    await IndexedDBService.clearAll();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('a restore that finds no admin session clears the persona cache too', async () => {
    await s().switchToPersona('finance');
    useAppStore.setState(overlayWrite({ impersonation: null, adminRole: null }));
    await s().restoreImpersonation();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('a boot with no admin session clears the persona cache even when no persona was active', async () => {
    await s().switchToPersona('finance');
    await s().stopImpersonation();
    useAppStore.setState(overlayWrite({ adminRole: null }));
    await s().restoreImpersonation();
    expect(await IndexedDBService.get('meta', 'persona:finance')).toBeUndefined();
  });

  it('a persona restored at boot older than 24 h refreshes once in the background', async () => {
    await s().switchToPersona('finance');
    useAppStore.setState(overlayWrite({ impersonation: null }));
    vi.setSystemTime(new Date(2026, 8, 28));
    m.fetchImpersonation.mockClear();
    m.fetchImpersonation.mockImplementation(async (sel: ImpersonationSelection) =>
      resultFor(sel, 'B-F-2')
    );
    await s().restoreImpersonation();
    await vi.waitFor(() => expect(codes()).toEqual(['B-F-2']));
    expect(m.fetchImpersonation).toHaveBeenCalledOnce();
  });

  it('a fresh persona restored at boot asks IS nothing', async () => {
    await s().switchToPersona('finance');
    useAppStore.setState(overlayWrite({ impersonation: null }));
    m.fetchImpersonation.mockClear();
    await s().restoreImpersonation();
    expect(s().impersonation?.selection.personaId).toBe('finance');
    expect(m.fetchImpersonation).not.toHaveBeenCalled();
  });
});
