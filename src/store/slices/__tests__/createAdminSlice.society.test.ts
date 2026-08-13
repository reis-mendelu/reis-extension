import { describe, it, expect, vi, beforeEach } from 'vitest';

// Which society is being authored, and how its posts reach the map. Split from
// createAdminSlice.test.ts (session + login/logout) to keep both under the
// repo's ~200-line convention.

const maybeSingle = vi.fn();
const order = vi.fn(async () => ({ data: [] as unknown[], error: null }));
vi.mock('../../../services/admin/authClient', () => ({
  adminAuthClient: {
    auth: {
      signInWithPassword: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle(), order: () => order() }) }),
    }),
  },
}));

const row = (id: string, associationId: string) => ({
  id,
  association_id: associationId,
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
});

vi.mock('../../../api/societyPosts', async (orig) => ({
  ...(await orig<typeof import('../../../api/societyPosts')>()),
  listMyPosts: vi.fn(),
}));

import { listMyPosts } from '../../../api/societyPosts';
import { useAppStore } from '../../useAppStore';

beforeEach(() => {
  vi.mocked(listMyPosts).mockReset();
  vi.mocked(listMyPosts).mockResolvedValue([row('e1', 'supef')]);
  useAppStore.setState({
    adminRole: null,
    adminAssociationId: null,
    adminActiveAssociationId: null,
    adminConsoleOpen: false,
    societyPosts: [],
    societyMapEvents: [],
    composerOpen: false,
    editEventId: null,
    placingEvent: false,
    draftCoord: null,
  });
});

describe('choosing the society being authored', () => {
  it('switches the society and reloads its posts', async () => {
    useAppStore.getState().setActiveAssociation('esn');
    expect(useAppStore.getState().adminActiveAssociationId).toBe('esn');
    await vi.waitFor(() => expect(listMyPosts).toHaveBeenCalledWith('esn'));
  });

  // Regression: switching left the previous society's authoring state running.
  // An open composer was the dangerous case — editEventId still referenced the
  // OLD society's event, so saving would have written to a society the header
  // no longer named.
  it("drops the previous society's authoring state", () => {
    useAppStore.setState({
      adminActiveAssociationId: 'supef',
      composerOpen: true,
      editEventId: 'supef-event-1',
      draftCoord: [16.61, 49.21],
    });
    useAppStore.getState().setActiveAssociation('esn');
    const s = useAppStore.getState();
    expect(s.adminActiveAssociationId).toBe('esn');
    expect(s.composerOpen).toBe(false);
    expect(s.editEventId).toBeNull();
    expect(s.draftCoord).toBeNull();
  });

  // Regression: two picker changes can resolve out of order. The slower, older
  // response used to win, leaving one society's events under another's name —
  // and delete/edit act on those rows, damaging a society nobody is looking at.
  it('ignores a stale response that arrives after a newer society was picked', async () => {
    let releaseEsn!: (v: ReturnType<typeof row>[]) => void;
    vi.mocked(listMyPosts).mockImplementation((id: string) => {
      if (id === 'esn') return new Promise((res) => (releaseEsn = res));
      return Promise.resolve([row('supef-1', 'supef')]);
    });

    useAppStore.getState().setActiveAssociation('esn'); // hangs
    useAppStore.getState().setActiveAssociation('supef'); // resolves first
    await vi.waitFor(() =>
      expect(useAppStore.getState().societyPosts.map((p) => p.id)).toEqual(['supef-1'])
    );

    releaseEsn([row('esn-1', 'esn')]); // the older request finally lands
    await vi.waitFor(() => expect(listMyPosts).toHaveBeenCalledTimes(2));

    expect(useAppStore.getState().adminActiveAssociationId).toBe('supef');
    expect(useAppStore.getState().societyPosts.map((p) => p.id)).toEqual(['supef-1']);
  });
});

describe('loading a society’s posts', () => {
  it('populates societyPosts for the active society', async () => {
    vi.mocked(listMyPosts).mockResolvedValueOnce([row('p1', 'supef')]);
    useAppStore.setState({ adminActiveAssociationId: 'supef' });
    await useAppStore.getState().loadSocietyPosts();
    expect(useAppStore.getState().societyPosts).toHaveLength(1);
    expect(useAppStore.getState().societyPosts[0]!.id).toBe('p1');
  });

  it('clears posts when no society is active', async () => {
    useAppStore.setState({ adminActiveAssociationId: null });
    await useAppStore.getState().loadSocietyPosts();
    expect(useAppStore.getState().societyPosts).toEqual([]);
  });
});

describe('admin ↔ map wiring', () => {
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

  // Regression: logout skipped the cleanup that closeSocietyAdmin did, and the
  // console header offers logout directly — so signing out mid-placement landed
  // you back on the STUDENT map with "click to place" still armed.
  it('logout also clears in-flight composer and placing state', async () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      adminRole: 'association',
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
      composerOpen: true,
      editEventId: 'e1',
      placingEvent: true,
      draftCoord: [16.6, 49.2],
    });
    await useAppStore.getState().adminLogout();
    const s = useAppStore.getState();
    expect(s.composerOpen).toBe(false);
    expect(s.editEventId).toBeNull();
    expect(s.placingEvent).toBe(false);
    expect(s.draftCoord).toBeNull();
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
