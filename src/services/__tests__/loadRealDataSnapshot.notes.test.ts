import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRealDataSnapshot } from '../loadRealDataSnapshot';
import { useAppStore } from '../../store/useAppStore';

vi.mock('../storage', () => ({
  IndexedDBService: { clear: vi.fn(async () => {}) },
}));
vi.mock('../../api/proxyClient', () => ({ isInIframe: () => false }));
// A stand-in store: the real one boots the Supabase auth client, which needs an
// installed platform and rejected unhandled after the tests (CI, PR #579).
vi.mock('../../store/useAppStore', () => {
  let state: Record<string, unknown> = { examNotes: {}, lastExamNotesFetchedAt: {} };
  return {
    useAppStore: {
      getState: () => state,
      setState: (u: unknown) => {
        const patch = typeof u === 'function' ? (u as (s: typeof state) => object)(state) : u;
        state = { ...state, ...(patch as object) };
      },
    },
  };
});

/** The dev scrape carries each term's Poznámka; the snapshot hands them to the store. */
describe('loadRealDataSnapshot — exam notes', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('puts the scraped Poznámka notes in the store as freshly fetched', async () => {
    const note = { text: 'Bez AI, jinak F.', isEmphasized: true };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ lastSync: 1, examNotes: { T1: note, T2: null } }), {
            status: 200,
          })
      )
    );
    const spy = vi.spyOn(window, 'postMessage').mockImplementation((() => {}) as never);

    await loadRealDataSnapshot();

    const state = useAppStore.getState();
    expect(state.examNotes).toMatchObject({ T1: note, T2: null });
    expect(state.lastExamNotesFetchedAt.T1).toBeGreaterThan(Date.now() - 5000);
    spy.mockRestore();
  });
});
