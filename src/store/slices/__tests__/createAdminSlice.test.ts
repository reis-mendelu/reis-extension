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
// exercises the real wiring against the full useAppStore instead.
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
import { useAppStore } from '../../useAppStore';

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
      // refreshSocietyMapEvents / closeComposer live on MapSlice; this local
      // harness only constructs AdminSlice, so stub what the slice calls.
      refreshSocietyMapEvents: vi.fn(),
      closeComposer: vi.fn(),
      clearMapSelection: vi.fn(),
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

  it('setActiveAssociation switches the society and reloads its posts', async () => {
    state.setActiveAssociation('esn');
    expect(state.adminActiveAssociationId).toBe('esn');
    await vi.waitFor(() => expect(listMyPosts).toHaveBeenCalledWith('esn'));
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

  it('loadSocietyPosts populates societyPosts for the active society', async () => {
    // listMyPosts is mocked at the module level (see top of file); override its
    // resolved value for this one call so the propagation assertion below still
    // pins the exact row id, same as before the module-level mock existed.
    vi.mocked(listMyPosts).mockResolvedValueOnce([
      {
        id: 'p1',
        association_id: 'supef',
        title: 'X',
        body: null,
        category: 'other',
        date: '2026-07-10',
        end_date: null,
        time: null,
        venue_kind: 'campus',
        room_code: null,
        coord_lng: null,
        coord_lat: null,
        location: null,
        url: null,
        created_by: null,
        visible_from: null,
      },
    ]);
    set({ adminActiveAssociationId: 'supef' });
    await state.loadSocietyPosts();
    expect(state.societyPosts).toHaveLength(1);
    expect(state.societyPosts[0]!.id).toBe('p1'); // safe: length asserted above
  });

  it('loadSocietyPosts clears posts when no society is active', async () => {
    set({ adminActiveAssociationId: null });
    await state.loadSocietyPosts();
    expect(state.societyPosts).toEqual([]);
  });
});

describe('admin ↔ map wiring', () => {
  beforeEach(() =>
    useAppStore.setState({
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
      adminConsoleOpen: false,
      societyPosts: [],
      societyMapEvents: [],
    })
  );

  it('refreshes society map events after loading posts', async () => {
    useAppStore.setState({ adminActiveAssociationId: 'supef' });
    await useAppStore.getState().loadSocietyPosts();
    expect(useAppStore.getState().societyMapEvents.length).toBeGreaterThan(0);
  });

  it('logout closes the console and drops the society events', async () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      adminRole: 'association',
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
    });
    await useAppStore.getState().adminLogout();
    expect(useAppStore.getState().adminConsoleOpen).toBe(false);
    expect(useAppStore.getState().societyMapEvents).toEqual([]);
  });

  it('closing the console clears in-flight composer state', () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      composerOpen: true,
      editEventId: 'e1',
      placingEvent: true,
      draftCoord: [16.6, 49.2],
    });
    useAppStore.getState().closeSocietyAdmin();
    const s = useAppStore.getState();
    expect(s.adminConsoleOpen).toBe(false);
    expect(s.composerOpen).toBe(false);
    expect(s.editEventId).toBeNull();
    expect(s.placingEvent).toBe(false);
    expect(s.draftCoord).toBeNull();
  });
});
