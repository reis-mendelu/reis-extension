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
      // refreshSocietyMapEvents lives on MapSlice; this local harness only
      // constructs AdminSlice, so stub it — loadSocietyPosts now calls it.
      refreshSocietyMapEvents: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  it('starts logged out with overlay closed', () => {
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminOverlayOpen).toBe(false);
  });

  it('opens and closes the overlay', () => {
    state.openAdminOverlay();
    expect(state.adminOverlayOpen).toBe(true);
    state.closeAdminOverlay();
    expect(state.adminOverlayOpen).toBe(false);
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

  it('logout clears everything', async () => {
    signIn.mockResolvedValue({
      data: { session: { user: { email: 'admin@esn.cz' } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.adminLogin('admin@esn.cz', 'pw');
    await state.adminLogout();
    expect(state.adminSession).toBeNull();
    expect(state.adminRole).toBeNull();
    expect(state.adminAssociationId).toBeNull();
  });

  it('loadAdminSession hydrates from a persisted session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'admin@esn.cz' } } } });
    maybeSingle.mockResolvedValue({ data: { role: 'association', association_id: 'esn' } });
    await state.loadAdminSession();
    expect(state.adminAssociationId).toBe('esn');
  });

  it('loadAdminSession signs out when the persisted session has no provisioned account', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { email: 'ghost@nowhere.cz' } } } });
    maybeSingle.mockResolvedValue({ data: null });
    await state.loadAdminSession();
    expect(state.adminSession).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('loadSocietyPosts populates societyPosts for the logged-in association', async () => {
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

describe('admin ↔ map wiring', () => {
  it('refreshes society map events after loading posts', async () => {
    useAppStore.setState({ adminAssociationId: 'supef' });
    await useAppStore.getState().loadSocietyPosts();
    expect(useAppStore.getState().societyMapEvents.length).toBeGreaterThan(0);
  });

  it('logout resets map mode to student', async () => {
    useAppStore.setState({
      mapMode: 'society',
      adminRole: 'association',
      adminAssociationId: 'supef',
    });
    await useAppStore.getState().adminLogout();
    expect(useAppStore.getState().mapMode).toBe('student');
    expect(useAppStore.getState().societyMapEvents).toEqual([]);
  });
});

describe('enterSocietyMode / openSocietyAdmin', () => {
  beforeEach(() =>
    useAppStore.setState({
      adminRole: null,
      adminAssociationId: null,
      adminOverlayOpen: false,
      mapMode: 'student',
      mapFocusRequest: 0,
      societyPosts: [],
      societyMapEvents: [],
    })
  );

  it('enterSocietyMode flips to society mode, closes overlay, requests map focus', () => {
    useAppStore.setState({
      adminRole: 'association',
      adminAssociationId: 'supef',
      adminOverlayOpen: true,
    });
    useAppStore.getState().enterSocietyMode();
    const s = useAppStore.getState();
    expect(s.mapMode).toBe('society');
    expect(s.adminOverlayOpen).toBe(false);
    expect(s.mapFocusRequest).toBe(1);
  });

  it('openSocietyAdmin enters society mode when logged in as association', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef' });
    useAppStore.getState().openSocietyAdmin();
    expect(useAppStore.getState().mapMode).toBe('society');
  });

  it('openSocietyAdmin opens the login overlay when not logged in', () => {
    useAppStore.getState().openSocietyAdmin();
    expect(useAppStore.getState().adminOverlayOpen).toBe(true);
    expect(useAppStore.getState().mapMode).toBe('student');
  });

  it('openSocietyAdmin still requests map focus when already in society mode (feedback, not a no-op)', () => {
    useAppStore.setState({
      adminRole: 'association',
      adminAssociationId: 'supef',
      mapMode: 'society',
      mapFocusRequest: 4,
    });
    useAppStore.getState().openSocietyAdmin();
    // Camera re-frame / view switch fires so the click always resolves to something.
    expect(useAppStore.getState().mapFocusRequest).toBe(5);
    expect(useAppStore.getState().mapMode).toBe('society');
  });
});
