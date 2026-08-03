import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSuggestionsSlice, type SuggestionsSlice } from '../createSuggestionsSlice';
import type { SuggestionRow } from '../../../types/suggestions';

const listSuggestions = vi.fn();
const setSuggestionStatus = vi.fn();
vi.mock('../../../api/suggestionsAdmin', () => ({
  listSuggestions: () => listSuggestions(),
  setSuggestionStatus: (id: number, status: string) => setSuggestionStatus(id, status),
}));

function row(id: number, status: SuggestionRow['status']): SuggestionRow {
  return {
    id,
    type: 'bug',
    title: `t${id}`,
    body: 'b',
    contact: null,
    screen: 'exams',
    ext_version: '4.0.0',
    browser_name: 'Chrome',
    browser_version: '131',
    viewport: '390x844',
    status,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

describe('createSuggestionsSlice', () => {
  let state: SuggestionsSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listSuggestions.mockReset();
    setSuggestionStatus.mockReset();
    setSuggestionStatus.mockResolvedValue(true);
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createSuggestionsSlice(set, get, {} as any);
  });

  it('starts empty with nothing unread', () => {
    expect(state.suggestions).toEqual([]);
    expect(state.suggestionsUnread).toBe(0);
  });

  it('counts only new items as unread', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'done'), row(3, 'new')]);
    await state.loadSuggestions();
    expect(state.suggestions).toHaveLength(3);
    expect(state.suggestionsUnread).toBe(2);
  });

  it('updates status optimistically and recounts unread', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'new')]);
    await state.loadSuggestions();
    await state.updateSuggestionStatus(1, 'done');
    expect(setSuggestionStatus).toHaveBeenCalledWith(1, 'done');
    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('done');
    expect(state.suggestionsUnread).toBe(1);
  });

  it('reverts the optimistic update when the write fails', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new')]);
    await state.loadSuggestions();
    setSuggestionStatus.mockResolvedValue(false);
    await state.updateSuggestionStatus(1, 'done');
    expect(setSuggestionStatus).toHaveBeenCalledWith(1, 'done');
    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('new');
    expect(state.suggestionsUnread).toBe(1);
  });

  it('resyncs with the server instead of reconstructing when a concurrent write on another row fails', async () => {
    // Reviewer-reported bug (round 1): updateSuggestionStatus snapshotted the
    // whole array before the optimistic write and blind-restored it on
    // failure. Two concurrent updates on different rows meant a failing row
    // A's revert stomped a successful row B's committed status back to its
    // pre-update value, even though the database already reflected B's write
    // correctly.
    //
    // Updated for round 3 (resync-on-failure): the assertions are unchanged,
    // but the failure path no longer reconstructs a remembered previous
    // status locally — it discards the local guess and refetches from the
    // server via loadSuggestions(). So this test now primes the
    // listSuggestions mock with the authoritative post-write server state
    // (row 1 still 'new' since its write never landed, row 2 'done' since
    // its write succeeded) before triggering A's failure.
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'new')]);
    await state.loadSuggestions();

    let resolveA: (ok: boolean) => void = () => {};
    let resolveB: (ok: boolean) => void = () => {};
    setSuggestionStatus.mockImplementation((id: number) => {
      if (id === 1) return new Promise((resolve) => { resolveA = resolve; });
      return new Promise((resolve) => { resolveB = resolve; });
    });

    const pA = state.updateSuggestionStatus(1, 'done'); // will fail
    const pB = state.updateSuggestionStatus(2, 'done'); // will succeed, and resolves first

    resolveB(true);
    await pB;

    // Server now authoritatively reflects B's success; A's write never landed.
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'done')]);

    resolveA(false);
    await pA;

    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('new');
    expect(state.suggestions.find((s) => s.id === 2)?.status).toBe('done');
    expect(state.suggestionsUnread).toBe(1);
  });

  it('resyncing after a write fails for a row a concurrent reload already removed is a safe no-op', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new')]);
    await state.loadSuggestions();

    let resolveWrite: (ok: boolean) => void = () => {};
    setSuggestionStatus.mockImplementation(
      () => new Promise((resolve) => { resolveWrite = resolve; })
    );

    const pUpdate = state.updateSuggestionStatus(1, 'done');

    // A reload completes while the write is still in flight and drops row 1.
    listSuggestions.mockResolvedValue([row(2, 'new')]);
    await state.loadSuggestions();

    resolveWrite(false); // the write fails; the failure path resyncs, not reverts
    await pUpdate;

    expect(state.suggestions.find((s) => s.id === 1)).toBeUndefined();
    expect(state.suggestions).toEqual([row(2, 'new')]);
    expect(state.suggestionsUnread).toBe(1);
  });

  it('regression: two failing writes racing on the same row resync to server state, not a reconstructed guess', async () => {
    // Reviewer-reported bug (round 3), failure mode 1: call A (id:1 -> 'done')
    // captures previous 'new' and writes optimistically. Before A resolves,
    // call B (id:1 -> 'triaged') starts and captures the optimistic,
    // unconfirmed 'done' as its own "previous". Both server writes fail. The
    // old reconstruct-on-failure code would revert A to 'new', then revert B
    // to 'done' — a value the server never accepted. The database actually
    // holds 'new'. Resync must land on 'new', not 'done'.
    listSuggestions.mockResolvedValue([row(1, 'new')]);
    await state.loadSuggestions();

    let resolveA: (ok: boolean) => void = () => {};
    let resolveB: (ok: boolean) => void = () => {};
    let call = 0;
    setSuggestionStatus.mockImplementation(() => {
      call += 1;
      if (call === 1) return new Promise((resolve) => { resolveA = resolve; });
      return new Promise((resolve) => { resolveB = resolve; });
    });

    const pA = state.updateSuggestionStatus(1, 'done'); // optimistic 'done', will fail
    const pB = state.updateSuggestionStatus(1, 'triaged'); // optimistic 'triaged' on top of unconfirmed 'done', will fail

    // Neither write is ever accepted server-side; the server still holds 'new'.
    listSuggestions.mockResolvedValue([row(1, 'new')]);

    resolveA(false);
    await pA;
    resolveB(false);
    await pB;

    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('new');
    expect(state.suggestionsUnread).toBe(1);
  });

  it('regression: a failing write resyncs instead of stamping a stale value over a fresher concurrent reload', async () => {
    // Reviewer-reported bug (round 3), failure mode 2: call A optimistically
    // sets row 1 to 'done'. A concurrent loadSuggestions() completes with
    // authoritative server data showing row 1 is actually 'triaged' (someone
    // else triaged it). A's write then fails. The old reconstruct-on-failure
    // code would revert to the remembered previous status ('new'), clobbering
    // the fresher authoritative value. Resync must leave 'triaged' in place.
    listSuggestions.mockResolvedValue([row(1, 'new')]);
    await state.loadSuggestions();

    let resolveWrite: (ok: boolean) => void = () => {};
    setSuggestionStatus.mockImplementation(
      () => new Promise((resolve) => { resolveWrite = resolve; })
    );

    const pUpdate = state.updateSuggestionStatus(1, 'done'); // optimistic 'done', will fail

    // A concurrent reload lands with fresher authoritative data.
    listSuggestions.mockResolvedValue([row(1, 'triaged')]);
    await state.loadSuggestions();
    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('triaged');

    resolveWrite(false); // A's write fails after the fact
    await pUpdate;

    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('triaged');
    expect(state.suggestionsUnread).toBe(0);
  });
});
