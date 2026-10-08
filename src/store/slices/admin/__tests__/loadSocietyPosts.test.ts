import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../api/societyPosts', () => ({ listMyPosts: vi.fn() }));
vi.mock('../../../../api/eventSignalsAdmin', () => ({ fetchEventSignals: vi.fn() }));

import { listMyPosts, type SpolkyEventRow } from '../../../../api/societyPosts';
import { fetchEventSignals } from '../../../../api/eventSignalsAdmin';
import { loadSocietyPosts } from '../loadSocietyPosts';

const post = (id: string) => ({ id }) as SpolkyEventRow;

/** A slice stand-in: the active society is whatever the test last picked. */
function makeAccess(active: string | null) {
  const state = { active, posts: [post('prev')], signals: {} as Record<string, unknown> };
  return {
    state,
    access: {
      activeAssociationId: () => state.active,
      setPosts: (p: SpolkyEventRow[]) => (state.posts = p),
      setSignals: (t: Record<string, unknown>) => (state.signals = t),
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
  vi.mocked(listMyPosts).mockReset();
  vi.mocked(fetchEventSignals).mockReset();
  vi.mocked(fetchEventSignals).mockResolvedValue({ totals: {}, ok: true });
});

describe('loadSocietyPosts', () => {
  // Publish and delete await this action before confirming; slow numbers must
  // not hold that up.
  it('resolves once the posts are in, without waiting for the numbers', async () => {
    const { state, access } = makeAccess('esn');
    const nums = deferred<{ totals: Record<string, never>; ok: boolean }>();
    vi.mocked(listMyPosts).mockResolvedValueOnce([post('a')]);
    vi.mocked(fetchEventSignals).mockReturnValueOnce(nums.promise as never);
    await loadSocietyPosts(access);
    expect(state.posts.map((p) => p.id)).toEqual(['a']);
    expect(state.signals).toEqual({});
    nums.resolve({ totals: { a: { seen: 1, opened: 0, linkTaps: 0 } } as never, ok: true });
    await nums.promise;
    await Promise.resolve();
    expect(state.signals).toEqual({ a: { seen: 1, opened: 0, linkTaps: 0 } });
  });

  it('keeps the numbers of the newer request', async () => {
    const { state, access } = makeAccess('esn');
    const stale = deferred<{ totals: Record<string, never>; ok: boolean }>();
    vi.mocked(listMyPosts).mockResolvedValue([post('e')]);
    vi.mocked(fetchEventSignals)
      .mockReturnValueOnce(stale.promise as never)
      .mockResolvedValueOnce({ totals: { e: { seen: 2, opened: 1, linkTaps: 0 } }, ok: true });
    const first = loadSocietyPosts(access);
    await vi.waitFor(() => expect(fetchEventSignals).toHaveBeenCalledTimes(1));
    await loadSocietyPosts(access);
    stale.resolve({ totals: {}, ok: true });
    await first;
    await Promise.resolve();
    expect(state.signals).toEqual({ e: { seen: 2, opened: 1, linkTaps: 0 } });
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

  // A failed read is not an empty society: after a publish, a network blip
  // used to wipe the list the society was looking at.
  it('keeps the previous posts when the read fails', async () => {
    const { state, access } = makeAccess('esn');
    vi.mocked(listMyPosts).mockResolvedValue(null);
    await loadSocietyPosts(access);
    expect(state.posts.map((p) => p.id)).toEqual(['prev']);
    expect(access.refreshSocietyMapEvents).not.toHaveBeenCalled();
  });
});
