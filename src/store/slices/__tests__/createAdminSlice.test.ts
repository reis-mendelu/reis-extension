import { describe, it, expect, vi, beforeEach } from 'vitest';

const signIn = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn();
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: { signInWithPassword: (...a: unknown[]) => signIn(...a), getSession: () => getSession(), signOut: () => signOut() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
  },
}));

import { createAdminSlice, type AdminSlice } from '../createAdminSlice';

describe('createAdminSlice', () => {
  let state: AdminSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    signIn.mockReset(); getSession.mockReset(); maybeSingle.mockReset();
    set = vi.fn((u) => { state = { ...state, ...(typeof u === 'function' ? u(state) : u) }; });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createAdminSlice(set, get, {} as any);
  });

  it('starts logged out with overlay closed', () => {
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminOverlayOpen).toBe(false);
  });

  it('opens and closes the overlay', () => {
    state.openAdminOverlay();  expect(state.adminOverlayOpen).toBe(true);
    state.closeAdminOverlay(); expect(state.adminOverlayOpen).toBe(false);
  });

  it('login success sets session, role and association', async () => {
    signIn.mockResolvedValue({ data: { session: { user: { email: 'supef@societies.reis.invalid' } } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'supef' } });
    const res = await state.adminLogin('supef', 'pw');
    expect(res.error).toBeUndefined();
    expect(state.adminRole).toBe('association');
    expect(state.adminAssociationId).toBe('supef');
    expect(state.adminSession).not.toBeNull();
  });

  it('login failure returns an error and stays logged out', async () => {
    signIn.mockResolvedValue({ data: { session: null }, error: { message: 'bad' } });
    const res = await state.adminLogin('supef', 'wrong');
    expect(res.error).toBeDefined();
    expect(state.adminSession).toBeNull();
  });

  it('logout clears everything', async () => {
    signIn.mockResolvedValue({ data: { session: { user: { email: 'x@societies.reis.invalid' } } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.adminLogin('esn', 'pw');
    await state.adminLogout();
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminAssociationId).toBeNull();
  });

  it('loadAdminSession hydrates from a persisted session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'esn@societies.reis.invalid' } } } });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.loadAdminSession();
    expect(state.adminAssociationId).toBe('esn');
  });
});
