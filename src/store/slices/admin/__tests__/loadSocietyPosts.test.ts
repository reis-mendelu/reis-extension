import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../api/societyPosts', () => ({ listMyPosts: vi.fn() }));

import { listMyPosts, type SpolkyEventRow } from '../../../../api/societyPosts';
import { loadSocietyPosts } from '../loadSocietyPosts';

const post = (id: string) => ({ id }) as SpolkyEventRow;

/** A slice stand-in: the active society is whatever the test last picked. */
function makeAccess(active: string | null) {
  const state = { active, posts: [post('prev')] };
  return {
    state,
    access: {
      activeAssociationId: () => state.active,
      setPosts: (p: SpolkyEventRow[]) => (state.posts = p),
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
});

describe('loadSocietyPosts', () => {
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
