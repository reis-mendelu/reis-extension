import { describe, it, expect, vi, beforeEach } from 'vitest';

const signIn = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn();
const order = vi.fn(async () => ({ data: [] as unknown[], error: null }));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: { signInWithPassword: (...a: unknown[]) => signIn(...a), getSession: () => getSession(), signOut: () => signOut() },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => maybeSingle(), order: () => order() }),
      }),
    }),
  },
}));

import { createAdminSlice, type AdminSlice } from '../createAdminSlice';

describe('createAdminSlice', () => {
  let state: AdminSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    signIn.mockReset(); getSession.mockReset(); maybeSingle.mockReset(); order.mockClear();
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

  it('loadSocietyPosts populates societyPosts for the logged-in association', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    order.mockResolvedValueOnce({ data: [{ id: 'p1', association_id: 'supef', title: 'X', date: '2026-07-10' }], error: null } as any);
    set({ adminAssociationId: 'supef' });
    await state.loadSocietyPosts();
    expect(state.societyPosts).toHaveLength(1);
    expect(state.societyPosts[0].id).toBe('p1');
  });

  it('loadSocietyPosts clears posts when there is no association', async () => {
    set({ adminAssociationId: null });
    await state.loadSocietyPosts();
    expect(state.societyPosts).toEqual([]);
  });
});
