import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../api/societyPosts', () => ({ listMyPosts: vi.fn() }));
vi.mock('../../../../api/eventRsvp', () => ({ fetchEventRsvps: vi.fn() }));
let devSociety: string | false = false;
vi.mock('../../../../utils/mock/devSociety', () => ({
  get DEV_SOCIETY() {
    return devSociety;
  },
}));

import { listMyPosts, type SpolkyEventRow } from '../../../../api/societyPosts';
import { fetchEventRsvps } from '../../../../api/eventRsvp';
import { loadSocietyPosts } from '../loadSocietyPosts';

const post = (id: string) => ({ id }) as SpolkyEventRow;

/** A slice stand-in: the active society is whatever the test last picked. */
function makeAccess(active: string | null) {
  const state = { active, posts: [post('prev')], counts: {} as Record<string, unknown> };
  return {
    state,
    access: {
      activeAssociationId: () => state.active,
      setPosts: (p: SpolkyEventRow[]) => (state.posts = p),
      setRsvpCounts: (c: Record<string, unknown>) => (state.counts = c),
      refreshSocietyMapEvents: vi.fn(),
    },
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  devSociety = false;
  vi.mocked(listMyPosts).mockReset();
  vi.mocked(fetchEventRsvps).mockReset();
  vi.mocked(fetchEventRsvps).mockResolvedValue({ counts: {}, ok: true });
});

describe('loadSocietyPosts', () => {
  // Publish and delete await this action before confirming; a slow count
  // request must not hold that up.
  it('resolves once the posts are in, without waiting for the RSVP counts', async () => {
    const { state, access } = makeAccess('esn');
    const counts = deferred<{
      counts: Record<string, { going: number; interested: number }>;
      ok: boolean;
    }>();
    vi.mocked(listMyPosts).mockResolvedValueOnce([post('a')]);
    vi.mocked(fetchEventRsvps).mockReturnValueOnce(counts.promise);

    await loadSocietyPosts(access);
    expect(state.posts.map((p) => p.id)).toEqual(['a']);
    expect(state.counts).toEqual({});

    counts.resolve({ counts: { a: { going: 1, interested: 2 } }, ok: true });
    await counts.promise;
    await Promise.resolve();
    expect(state.counts).toEqual({ a: { going: 1, interested: 2 } });
  });

  // A → B → A: the first A request is for the society on screen again, so an
  // id check alone let it land after the newer A request and win.
  it('ignores an older request for the same society once a newer one ran', async () => {
    const { state, access } = makeAccess('esn');
    const stale = deferred<SpolkyEventRow[] | null>();
    vi.mocked(listMyPosts)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce([post('fresh')]);

    const first = loadSocietyPosts(access);
    await loadSocietyPosts(access);
    expect(state.posts.map((p) => p.id)).toEqual(['fresh']);

    stale.resolve([post('stale')]);
    await first;
    expect(state.posts.map((p) => p.id)).toEqual(['fresh']);
  });

  it('keeps the RSVP counts of the newer request too', async () => {
    const { state, access } = makeAccess('esn');
    const staleCounts = deferred<{ counts: Record<string, never>; ok: boolean }>();
    vi.mocked(listMyPosts).mockResolvedValue([post('e')]);
    vi.mocked(fetchEventRsvps)
      .mockReturnValueOnce(staleCounts.promise as never)
      .mockResolvedValueOnce({ counts: { e: { going: 1, interested: 0 } }, ok: true } as never);

    const first = loadSocietyPosts(access);
    await vi.waitFor(() => expect(fetchEventRsvps).toHaveBeenCalledTimes(1));
    await loadSocietyPosts(access);
    staleCounts.resolve({ counts: {}, ok: true });
    await first;
    expect(state.counts).toEqual({ e: { going: 1, interested: 0 } });
  });

  // A failed read is not an empty society: after a publish, a network blip
  // used to wipe the list the society was looking at.
  it('keeps the previous posts when the read fails', async () => {
    const { state, access } = makeAccess('esn');
    vi.mocked(listMyPosts).mockResolvedValue(null);
    await loadSocietyPosts(access);
    expect(state.posts.map((p) => p.id)).toEqual(['prev']);
    expect(access.refreshSocietyMapEvents).not.toHaveBeenCalled();
    expect(fetchEventRsvps).not.toHaveBeenCalled();
  });

  // dev:web's in-memory store hands out `dev-N` ids, which the RSVP RPC
  // (uuid[]) rejects: every reload logged an error and saves waited on it.
  it('skips the RSVP fetch for the dev society store', async () => {
    devSociety = 'reis';
    const { state, access } = makeAccess('reis');
    vi.mocked(listMyPosts).mockResolvedValue([post('dev-1')]);
    await loadSocietyPosts(access);
    expect(state.posts.map((p) => p.id)).toEqual(['dev-1']);
    expect(fetchEventRsvps).not.toHaveBeenCalled();
  });
});
