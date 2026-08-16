import { describe, it, expect, vi, beforeEach } from 'vitest';

const signIn = vi.fn();
const getSession = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn();
const order = vi.fn(async () => ({ data: [] as unknown[], error: null }));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signIn(...a),
      getSession: () => getSession(),
      signOut: () => signOut(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => maybeSingle(), order: () => order() }),
      }),
    }),
  },
}));

// listMyPosts is mocked at the module level (spread-original so createPost/
// updatePost/deletePost/toRow keep their real implementations for other
// tests). Local-harness tests below use a minimal AdminSlice-only get()/set()
// pair, so loadSocietyPosts's new get().refreshSocietyMapEvents() call (a
// MapSlice method) is stubbed onto `state` — the "admin ↔ map wiring" suite
// wiring against the full useAppStore lives in createAdminSlice.society.test.ts.
vi.mock('../../../api/societyPosts', async (orig) => ({
  ...(await orig<typeof import('../../../api/societyPosts')>()),
  listMyPosts: vi.fn().mockResolvedValue([
    {
      id: 'e1',
      association_id: 'supef',
      title: 'X',
      body: null,
      category: 'party',
      date: '2026-07-10',
      end_date: null,
      time: null,
      venue_kind: 'offcampus',
      room_code: null,
      coord_lng: 16.6,
      coord_lat: 49.2,
      location: null,
      url: null,
      created_by: null,
      visible_from: null,
    },
  ]),
}));

import { createAdminSlice, type AdminSlice } from '../createAdminSlice';
import { listMyPosts } from '../../../api/societyPosts';

describe('createAdminSlice', () => {
  let state: AdminSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    signIn.mockReset();
    getSession.mockReset();
    signOut.mockClear();
    maybeSingle.mockReset();
    order.mockClear();
    vi.mocked(listMyPosts).mockClear();
    set = vi.fn((u) => {
      state = { ...state, ...(typeof u === 'function' ? u(state) : u) };
    });
    get = vi.fn(() => state);
    state = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createAdminSlice(set, get, {} as any),
      // refreshSocietyMapEvents / closeComposer live on MapSlice and
      // loadSuggestions on SuggestionsSlice; this local harness only
      // constructs AdminSlice, so stub what the slice calls.
      refreshSocietyMapEvents: vi.fn(),
      closeComposer: vi.fn(),
      clearMapSelection: vi.fn(),
      loadSuggestions: vi.fn().mockResolvedValue(undefined),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  it('starts logged out with the console closed', () => {
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminConsoleOpen).toBe(false);
    expect(state.adminActiveAssociationId).toBeNull();
  });

  it('openSocietyAdmin opens the console even with no session', () => {
    state.openSocietyAdmin();
    expect(state.adminConsoleOpen).toBe(true);
    expect(state.adminSession).toBeNull();
  });

  it('closeSocietyAdmin closes the console but keeps the session', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'admin@supef.cz' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'supef' } });
    await state.adminLogin('admin@supef.cz', 'pw');
    state.openSocietyAdmin();
    state.closeSocietyAdmin();
    expect(state.adminConsoleOpen).toBe(false);
    expect(state.adminSession).not.toBeNull();
    expect(state.adminActiveAssociationId).toBe('supef');
  });

  it('login success sets session, role and association', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'admin@supef.cz' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'supef' } });
    const res = await state.adminLogin('admin@supef.cz', 'pw');
    expect(res.error).toBeUndefined();
    expect(state.adminRole).toBe('association');
    expect(state.adminAssociationId).toBe('supef');
    expect(state.adminSession).not.toBeNull();
  });

  it('an association login pins the active society to its own', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'admin@supef.cz' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'supef' } });
    await state.adminLogin('admin@supef.cz', 'pw');
    expect(state.adminActiveAssociationId).toBe('supef');
  });

  // The real reis_admin account, as it exists in spolky_accounts: it carries
  // association_id 'reis' rather than null — 'reis' being a society in its own
  // right, which posts campus-wide events. So a reIS admin does NOT start at an
  // empty "choose a society" state; it starts on its own and the header's
  // picker moves it. Worth pinning, because the obvious assumption (an admin
  // belongs to no society) is the wrong one.
  it('a reis_admin login starts on its own society', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'reis.mendelu@gmail.com' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: { role: 'reis_admin', association_id: 'reis' } });
    await state.adminLogin('reis.mendelu@gmail.com', 'pw');
    expect(state.adminRole).toBe('reis_admin');
    expect(state.adminAssociationId).toBe('reis');
    expect(state.adminActiveAssociationId).toBe('reis');
  });

  // Kept alongside the above: an account with no society must not crash or
  // silently author under a bogus id — it lands on the picker's empty state.
  it('a reis_admin with no society of its own waits for the picker', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'someone@reis.cz' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: { role: 'reis_admin', association_id: null } });
    await state.adminLogin('someone@reis.cz', 'pw');
    expect(state.adminActiveAssociationId).toBeNull();
  });

  it('login failure returns an error and stays logged out', async () => {
    signIn.mockResolvedValue({ data: { session: null }, error: { message: 'bad' } });
    const res = await state.adminLogin('admin@supef.cz', 'wrong');
    expect(res.error).toBeDefined();
    expect(state.adminSession).toBeNull();
  });

  it('valid password but unprovisioned account fails and stays logged out', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'ghost@nowhere.cz' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: null });
    const res = await state.adminLogin('ghost@nowhere.cz', 'pw');
    expect(res.error).toBeDefined();
    expect(state.adminSession).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('logout clears everything and closes the console', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'admin@esn.cz' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.adminLogin('admin@esn.cz', 'pw');
    state.openSocietyAdmin();
    await state.adminLogout();
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminAssociationId).toBeNull();
    expect(state.adminActiveAssociationId).toBeNull();
    expect(state.adminConsoleOpen).toBe(false);
  });

  it('loadAdminSession hydrates from a persisted session without opening the console', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'admin@esn.cz' } } } });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.loadAdminSession();
    expect(state.adminAssociationId).toBe('esn');
    expect(state.adminActiveAssociationId).toBe('esn');
    expect(state.adminConsoleOpen).toBe(false);
  });

  it('loadAdminSession signs out when the persisted session has no provisioned account', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'ghost@nowhere.cz' } } } });
    maybeSingle.mockResolvedValue({ data: null });
    await state.loadAdminSession();
    expect(state.adminSession).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('createAdminSlice boot', () => {
  // Local harness (not the full useAppStore) so loadSuggestions can be a bare
  // spy — this suite only cares whether loadAdminSession calls it, not what it does.
  let state: Record<string, unknown>;
  let bootSet: ReturnType<typeof vi.fn>;
  let bootGet: ReturnType<typeof vi.fn>;
  const loadSuggestions = vi.fn();

  beforeEach(() => {
    getSession.mockReset();
    maybeSingle.mockReset();
    signOut.mockClear();
    loadSuggestions.mockReset();
    loadSuggestions.mockResolvedValue(undefined);
    bootSet = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    bootGet = vi.fn(() => state);
    state = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createAdminSlice(bootSet as any, bootGet as any, {} as any),
      loadSuggestions,
      suggestionsUnread: 0,
      setMapMode: vi.fn(),
      focusCampus: vi.fn(),
      refreshSocietyMapEvents: vi.fn(),
    };
  });

  it('loads suggestions for a reis_admin session', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { email: 'reis.mendelu@gmail.com' } } },
    });
    maybeSingle.mockResolvedValue({
      data: { role: 'reis_admin', association_id: null },
      error: null,
    });
    await (state.loadAdminSession as () => Promise<void>)();
    expect(loadSuggestions).toHaveBeenCalledTimes(1);
  });

  it('does not load suggestions for an association session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'admin@supef.cz' } } } });
    maybeSingle.mockResolvedValue({
      data: { role: 'association', association_id: 'supef' },
      error: null,
    });
    await (state.loadAdminSession as () => Promise<void>)();
    expect(loadSuggestions).not.toHaveBeenCalled();
  });

  it('does nothing when there is no stored session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await (state.loadAdminSession as () => Promise<void>)();
    expect(loadSuggestions).not.toHaveBeenCalled();
  });
});
