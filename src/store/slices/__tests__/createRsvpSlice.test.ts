import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchEventRsvps = vi.fn();
const setEventRsvp = vi.fn();
vi.mock('../../../api/eventRsvp', () => ({
  fetchEventRsvps: (...a: unknown[]) => fetchEventRsvps(...a),
  setEventRsvp: (...a: unknown[]) => setEventRsvp(...a),
}));

const idb = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));

const syncReminders = vi.fn();
vi.mock('../../../services/eventReminders/sync', () => ({
  syncReminders: (...a: unknown[]) => syncReminders(...a),
}));

import { createRsvpSlice, type RsvpSlice } from '../createRsvpSlice';
import type { MapEvent } from '../../../types/events';

describe('createRsvpSlice', () => {
  // The slice reads studentId and mapEvents off the composed store; the test
  // supplies just those two neighbours rather than the whole thing.
  let state: RsvpSlice & { mapEvents: MapEvent[] };
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    idb.clear();
    fetchEventRsvps.mockReset().mockResolvedValue({ counts: {}, ok: true });
    setEventRsvp.mockReset().mockResolvedValue(true);
    syncReminders.mockReset().mockResolvedValue(undefined);
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = { ...createRsvpSlice(set, get, {} as any), mapEvents: [] };
  });

  it('starts with no responses and no counts', () => {
    expect(state.rsvp).toEqual({});
    expect(state.rsvpCounts).toEqual({});
  });

  describe('loading real counts', () => {
    it('replaces the invented numbers with what the backend reports', async () => {
      idb.set('event_rsvps_mine', { e1: 'interested' });
      fetchEventRsvps.mockResolvedValue({
        counts: { e1: { going: 4, interested: 2 } },
        ok: true,
      });
      await state.loadRsvps(['e1']);
      // No identity is sent — the server is never told who is asking.
      expect(fetchEventRsvps).toHaveBeenCalledWith(['e1']);
      expect(state.rsvpCounts.e1).toEqual({ going: 4, interested: 2 });
      // The device's own answer comes from IndexedDB, not the response.
      expect(state.rsvp.e1).toBe('interested');
    });

    // An event nobody has answered is a real, honest zero — not a missing
    // number and certainly not a hashed-up 108.
    it('reports a genuine zero for an event with no attendance', async () => {
      fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 0, interested: 0 } }, ok: true });
      await state.loadRsvps(['e1']);
      expect(state.rsvpCounts.e1).toEqual({ going: 0, interested: 0 });
    });

    it('does not ask about nothing', async () => {
      await state.loadRsvps([]);
      expect(fetchEventRsvps).not.toHaveBeenCalled();
    });
  });

  describe('answering', () => {
    it('shows the response immediately, before the write lands', async () => {
      let resolve!: (v: boolean) => void;
      setEventRsvp.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));
      const pending = state.setRsvp('e1', 'going');

      expect(state.rsvp.e1).toBe('going');
      expect(state.rsvpCounts.e1?.going).toBe(1);

      resolve(true);
      await pending;
      expect(state.rsvp.e1).toBe('going');
    });

    it('moves the count across when switching Going to Interested', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 2 } };
      await state.setRsvp('e1', 'going');
      expect(state.rsvpCounts.e1).toEqual({ going: 5, interested: 2 });
      await state.setRsvp('e1', 'interested');
      expect(state.rsvpCounts.e1).toEqual({ going: 4, interested: 3 });
    });

    it('tapping the active status clears the response and its count', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 0 } };
      await state.setRsvp('e1', 'going');
      expect(state.rsvpCounts.e1?.going).toBe(5);
      await state.setRsvp('e1', 'going');
      expect(state.rsvp.e1).toBeUndefined();
      expect(state.rsvpCounts.e1?.going).toBe(4);
      expect(setEventRsvp).toHaveBeenLastCalledWith('e1', null);
    });

    it('keeps per-event responses independent', async () => {
      await state.setRsvp('e1', 'going');
      await state.setRsvp('e2', 'interested');
      expect(state.rsvp).toEqual({ e1: 'going', e2: 'interested' });
    });

    // The whole point of replacing the mock is that the number on the card is
    // real. A count that only exists on this device is the same lie in a
    // smaller font, so a rejected write is rolled back.
    it('rolls back when the write is refused', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 2 } };
      setEventRsvp.mockResolvedValue(false);

      await state.setRsvp('e1', 'going');

      expect(state.rsvp.e1).toBeUndefined();
      expect(state.rsvpCounts.e1).toEqual({ going: 4, interested: 2 });
    });

    it('restores the previous answer, not just the absence of one', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 2 } };
      await state.setRsvp('e1', 'going');
      setEventRsvp.mockResolvedValue(false);

      await state.setRsvp('e1', 'interested');

      expect(state.rsvp.e1).toBe('going');
      expect(state.rsvpCounts.e1).toEqual({ going: 5, interested: 2 });
    });

    it('never drives a count below zero', async () => {
      state.rsvpCounts = { e1: { going: 0, interested: 0 } };
      state.rsvp = { e1: 'going' };
      await state.setRsvp('e1', 'going');
      expect(state.rsvpCounts.e1?.going).toBe(0);
    });
  });

  describe('reminders', () => {
    const party = {
      id: 'e1',
      title: 'Beánie PEF',
      url: '',
      date: '2999-09-10',
      endDate: null,
      time: '19:00',
      location: 'Q01',
      imageUrl: null,
      organizerKey: 'pef',
      societyId: 'supef',
      coord: [16.61, 49.21],
      roomCode: null,
      venueKind: 'campus',
      category: 'party',
    };

    it('schedules a reminder when the student says they are going', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      expect(syncReminders).toHaveBeenCalledWith([expect.objectContaining({ eventId: 'e1' })]);
    });

    // Backing out has to take the notification with it.
    it('drops the reminder when the student un-RSVPs', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      syncReminders.mockClear();
      await state.setRsvp('e1', 'going');
      expect(syncReminders).toHaveBeenCalledWith([]);
    });

    it('does not schedule anything off the back of a refused write', async () => {
      state.mapEvents = [party] as never;
      setEventRsvp.mockResolvedValue(false);
      await state.setRsvp('e1', 'going');
      expect(syncReminders).toHaveBeenCalledWith([]);
    });

    // Reopening the app restores the student's answers, so their reminders have
    // to come back with them — on a fresh install there is nothing pending.
    it('restores reminders for answers loaded from the backend', async () => {
      state.mapEvents = [party] as never;
      idb.set('event_rsvps_mine', { e1: 'going' });
      fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 1, interested: 0 } }, ok: true });
      await state.loadRsvps(['e1']);
      expect(syncReminders).toHaveBeenCalledWith([expect.objectContaining({ eventId: 'e1' })]);
    });
  });
});

/**
 * Two failure modes reviewers caught, both of which quietly destroy state.
 */
describe('createRsvpSlice — failure handling', () => {
  // Writes are chained per event, so even the first one is issued a microtask
  // after the tap. Tests that assert on what has been SENT have to let that
  // turn run; tests that assert on store state do not, because the optimistic
  // update is synchronous.
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  const party = {
    id: 'e1',
    title: 'Beánie',
    url: '',
    date: '2999-09-10',
    endDate: null,
    time: '19:00',
    location: 'Q01',
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord: [16.61, 49.21],
    roomCode: null,
    venueKind: 'campus',
    category: 'party',
  };
  let state: RsvpSlice & { mapEvents: MapEvent[] };
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    idb.clear();
    fetchEventRsvps.mockReset().mockResolvedValue({ counts: {}, ok: true });
    setEventRsvp.mockReset().mockResolvedValue(true);
    syncReminders.mockReset().mockResolvedValue(undefined);
    set = vi.fn((u) => {
      const p = typeof u === 'function' ? u(state) : u;
      state = { ...state, ...p };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = { ...createRsvpSlice(set, get, {} as any), mapEvents: [party] as never };
  });

  // A failed load leaves `rsvp` empty; reconciling from that would cancel every
  // pending notification for events the student is still going to.
  it('does not touch reminders when the load failed', async () => {
    idb.set('event_rsvps_mine', { e1: 'going' });
    fetchEventRsvps.mockResolvedValue({ counts: {}, ok: false });
    await state.loadRsvps(['e1']);
    expect(syncReminders).not.toHaveBeenCalled();
  });

  it('keeps the previous counts rather than overwriting them with zeroes', async () => {
    state.rsvpCounts = { e1: { going: 7, interested: 1 } };
    fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 0, interested: 0 } }, ok: false });
    await state.loadRsvps(['e1']);
    expect(state.rsvpCounts.e1).toEqual({ going: 7, interested: 1 });
  });

  // An older request failing after a newer one succeeded must not erase the
  // newer choice, nor an unrelated event's.
  it('rolls back only the event that failed', async () => {
    await state.setRsvp('e2', 'going');
    setEventRsvp.mockResolvedValue(false);
    await state.setRsvp('e1', 'going');
    expect(state.rsvp.e2).toBe('going');
    expect(state.rsvp.e1).toBeUndefined();
  });

  it('persists the answer to the device once the write lands', async () => {
    await state.setRsvp('e1', 'going');
    await flush();
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going' });
  });

  // A storage failure must not take the counts down with it: real attendance
  // still renders, the device just does not know its own answer yet.
  it('still loads counts when the local answers cannot be read', async () => {
    const { IndexedDBService } = await import('../../../services/storage');
    vi.mocked(IndexedDBService.get).mockRejectedValueOnce(new Error('idb closed'));
    fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 4, interested: 2 } }, ok: true });

    await expect(state.loadRsvps(['e1'])).resolves.toBeUndefined();

    expect(state.rsvpCounts.e1).toEqual({ going: 4, interested: 2 });
    // …and reminders are NOT reconciled from answers we failed to read, which
    // would be an empty plan and would cancel everything.
    expect(syncReminders).not.toHaveBeenCalled();
  });

  // Tap Going, wait for it to actually be sent, then tap Interested while it is
  // still unanswered. The first request loses and fails; its rollback must not
  // resurrect the answer the student already replaced.
  it('ignores a superseded request that fails after a newer one succeeded', async () => {
    let failFirst!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(() => new Promise<boolean>((r) => (failFirst = r)))
      .mockResolvedValue(true);

    const first = state.setRsvp('e1', 'going');
    await flush(); // the Going request is now genuinely out
    const second = state.setRsvp('e1', 'interested');
    expect(state.rsvp.e1).toBe('interested');

    failFirst(false);
    await Promise.all([first, second]);

    expect(state.rsvp.e1).toBe('interested');
    expect(state.rsvpCounts.e1?.interested).toBe(1);
  });

  // The mirror case: the loser SUCCEEDS. It must not persist its stale answer.
  it('ignores a superseded request that succeeds late', async () => {
    let landFirst!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(() => new Promise<boolean>((r) => (landFirst = r)))
      .mockResolvedValue(true);

    const first = state.setRsvp('e1', 'going');
    await flush();
    const second = state.setRsvp('e1', 'interested');

    landFirst(true);
    await Promise.all([first, second]);

    expect(state.rsvp.e1).toBe('interested');
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'interested' });
  });

  // The client-side revision guard cannot fix the SERVER: two requests issued
  // back to back can reach Postgres in either order, and the upsert has no
  // ordering guard, so a Going issued first and arriving last would win the row
  // while the device sits on Interested. get_event_rsvps returns counts only —
  // by design — so nothing would ever detect the divergence. Chaining per event
  // is what makes "last tap wins" true at the server too.
  it('sends the next write only after the previous one is answered', async () => {
    const sent: (string | null)[] = [];
    let releaseFirst!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce((_id: string, status: string | null) => {
        sent.push(status);
        return new Promise<boolean>((r) => (releaseFirst = r));
      })
      .mockImplementation(async (_id: string, status: string | null) => {
        sent.push(status);
        return true;
      });

    const first = state.setRsvp('e1', 'going');
    await flush();
    expect(sent).toEqual(['going']);

    const second = state.setRsvp('e1', 'interested');
    await flush();
    // Still one: the second is queued behind an unanswered request rather than
    // racing it to the database.
    expect(sent).toEqual(['going']);

    releaseFirst(true);
    await Promise.all([first, second]);

    expect(sent).toEqual(['going', 'interested']);
  });

  // Taps faster than a round trip collapse: a tap that is already obsolete when
  // its turn comes is dropped rather than sent, so three quick taps cost one
  // request and the server is told the answer the student actually left on.
  it('collapses taps made faster than a round trip into one write', async () => {
    const sent: (string | null)[] = [];
    setEventRsvp.mockImplementation(async (_id: string, status: string | null) => {
      sent.push(status);
      return true;
    });

    const a = state.setRsvp('e1', 'going');
    const b = state.setRsvp('e1', 'interested');
    const c = state.setRsvp('e1', 'going');
    await Promise.all([a, b, c]);

    expect(sent).toEqual(['going']);
    expect(state.rsvp.e1).toBe('going');
  });

  // Queueing is per event: answering one card must not wait on another's
  // request, which would make an unrelated tap feel stuck.
  it('does not queue one event behind another', async () => {
    const sent: string[] = [];
    setEventRsvp
      .mockImplementationOnce((id: string) => {
        sent.push(id);
        return new Promise<boolean>(() => {});
      })
      .mockImplementation(async (id: string) => {
        sent.push(id);
        return true;
      });

    void state.setRsvp('e1', 'going');
    await flush();
    await state.setRsvp('e2', 'interested');

    expect(sent).toEqual(['e1', 'e2']);
    expect(state.rsvp.e2).toBe('interested');
  });

  // Storage must carry CONFIRMED answers only. An optimistic answer written to
  // disk survives the process: kill the app before the request settles and the
  // next launch reads an answer the server never accepted, treats it as
  // confirmed, and can schedule a reminder from it.
  it('never writes an answer the server has not accepted', async () => {
    let settleE2!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(async () => true)
      .mockImplementationOnce(() => new Promise<boolean>((r) => (settleE2 = r)));

    const first = state.setRsvp('e1', 'going');
    const second = state.setRsvp('e2', 'interested');
    await first;
    await flush();

    // e2 is optimistic in the UI…
    expect(state.rsvp.e2).toBe('interested');
    // …and deliberately absent from disk.
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going' });

    settleE2(true);
    await second;
    await flush();
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going', e2: 'interested' });
  });

  // The same, for the outcome that made the old behaviour dangerous.
  it('leaves a refused answer out of storage entirely', async () => {
    let settleE2!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(async () => true)
      .mockImplementationOnce(() => new Promise<boolean>((r) => (settleE2 = r)));

    const first = state.setRsvp('e1', 'going');
    const second = state.setRsvp('e2', 'interested');
    await first;

    settleE2(false);
    await second;
    await flush();

    expect(state.rsvp.e2).toBeUndefined();
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going' });
  });

  // Storage is merged rather than replaced: loadRsvps is detached, so a tap can
  // beat it, and a wholesale write would drop answers this session never loaded.
  it('keeps stored answers for events this session has not loaded', async () => {
    idb.set('event_rsvps_mine', { older: 'going' });
    setEventRsvp.mockResolvedValue(true);

    await state.setRsvp('e1', 'interested');
    await flush();

    expect(idb.get('event_rsvps_mine')).toEqual({ older: 'going', e1: 'interested' });
  });

  // A write the server ACCEPTED is confirmed even if a newer tap has arrived
  // meanwhile. Dropping it left `confirmed` empty, so a later failure rolled the
  // card back to "no answer" while the server still held the accepted one.
  it('remembers a superseded write that the server accepted', async () => {
    let landGoing!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(() => new Promise<boolean>((r) => (landGoing = r)))
      .mockImplementationOnce(async () => false); // the queued Interested fails

    const first = state.setRsvp('e1', 'going');
    await flush();
    const second = state.setRsvp('e1', 'interested');

    landGoing(true);
    await Promise.all([first, second]);
    await flush();

    // Going is what the server holds, so that is what the card and disk show.
    expect(state.rsvp.e1).toBe('going');
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going' });
  });

  // Tap Going, wait for it to actually be sent, then tap Interested while it is
  // still unanswered. The first request loses and fails; its rollback must not
  // resurrect the answer the student already replaced.
  it('ignores a superseded request that fails after a newer one succeeded', async () => {
    let failFirst!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(() => new Promise<boolean>((r) => (failFirst = r)))
      .mockResolvedValue(true);

    const first = state.setRsvp('e1', 'going');
    await flush(); // the Going request is now genuinely out
    const second = state.setRsvp('e1', 'interested');
    expect(state.rsvp.e1).toBe('interested');

    failFirst(false);
    await Promise.all([first, second]);

    expect(state.rsvp.e1).toBe('interested');
    expect(state.rsvpCounts.e1?.interested).toBe(1);
  });

  // The mirror case: the loser SUCCEEDS. It must not persist its stale answer.
  it('ignores a superseded request that succeeds late', async () => {
    let landFirst!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(() => new Promise<boolean>((r) => (landFirst = r)))
      .mockResolvedValue(true);

    const first = state.setRsvp('e1', 'going');
    await flush();
    const second = state.setRsvp('e1', 'interested');

    landFirst(true);
    await Promise.all([first, second]);

    expect(state.rsvp.e1).toBe('interested');
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'interested' });
  });

  // The client-side revision guard cannot fix the SERVER: two requests issued
  // back to back can reach Postgres in either order, and the upsert has no
  // ordering guard, so a Going issued first and arriving last would win the row
  // while the device sits on Interested. get_event_rsvps returns counts only —
  // by design — so nothing would ever detect the divergence. Chaining per event
  // is what makes "last tap wins" true at the server too.
  it('sends the next write only after the previous one is answered', async () => {
    const sent: (string | null)[] = [];
    let releaseFirst!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce((_id: string, status: string | null) => {
        sent.push(status);
        return new Promise<boolean>((r) => (releaseFirst = r));
      })
      .mockImplementation(async (_id: string, status: string | null) => {
        sent.push(status);
        return true;
      });

    const first = state.setRsvp('e1', 'going');
    await flush();
    expect(sent).toEqual(['going']);

    const second = state.setRsvp('e1', 'interested');
    await flush();
    // Still one: the second is queued behind an unanswered request rather than
    // racing it to the database.
    expect(sent).toEqual(['going']);

    releaseFirst(true);
    await Promise.all([first, second]);

    expect(sent).toEqual(['going', 'interested']);
  });

  // Taps faster than a round trip collapse: a tap that is already obsolete when
  // its turn comes is dropped rather than sent, so three quick taps cost one
  // request and the server is told the answer the student actually left on.
  it('collapses taps made faster than a round trip into one write', async () => {
    const sent: (string | null)[] = [];
    setEventRsvp.mockImplementation(async (_id: string, status: string | null) => {
      sent.push(status);
      return true;
    });

    const a = state.setRsvp('e1', 'going');
    const b = state.setRsvp('e1', 'interested');
    const c = state.setRsvp('e1', 'going');
    await Promise.all([a, b, c]);

    expect(sent).toEqual(['going']);
    expect(state.rsvp.e1).toBe('going');
  });

  // Queueing is per event: answering one card must not wait on another's
  // request, which would make an unrelated tap feel stuck.
  it('does not queue one event behind another', async () => {
    const sent: string[] = [];
    setEventRsvp
      .mockImplementationOnce((id: string) => {
        sent.push(id);
        return new Promise<boolean>(() => {});
      })
      .mockImplementation(async (id: string) => {
        sent.push(id);
        return true;
      });

    void state.setRsvp('e1', 'going');
    await flush();
    await state.setRsvp('e2', 'interested');

    expect(sent).toEqual(['e1', 'e2']);
    expect(state.rsvp.e2).toBe('interested');
  });

  // Going -> Interested -> Going, all faster than a round trip. Only the final
  // Going is sent; if it fails, rolling back to "what the map said at tap time"
  // lands on Interested — an answer no request ever carried and the server has
  // never heard of. It would then persist and schedule a reminder.
  it('rolls back to the last answer the server accepted, not an uncommitted one', async () => {
    setEventRsvp.mockResolvedValue(false);

    const a = state.setRsvp('e1', 'going');
    const b = state.setRsvp('e1', 'interested');
    const c = state.setRsvp('e1', 'going');
    await Promise.all([a, b, c]);

    // Nothing was ever confirmed, so the card shows no answer at all.
    expect(state.rsvp.e1).toBeUndefined();
    expect(idb.get('event_rsvps_mine')).toEqual({});
    expect(state.rsvpCounts.e1).toEqual({ going: 0, interested: 0 });
  });

  // The same rollback must land on a REAL previous answer when there is one.
  it('rolls back to a previously confirmed answer', async () => {
    setEventRsvp.mockResolvedValueOnce(true);
    await state.setRsvp('e1', 'going');
    expect(state.rsvp.e1).toBe('going');

    setEventRsvp.mockResolvedValue(false);
    await state.setRsvp('e1', 'interested');

    expect(state.rsvp.e1).toBe('going');
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going' });
  });

  // An answer restored from the device at load counts as confirmed: it only got
  // there because a write settled.
  it('treats an answer loaded from the device as confirmed', async () => {
    idb.set('event_rsvps_mine', { e1: 'going' });
    fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 1, interested: 0 } }, ok: true });
    await state.loadRsvps(['e1']);

    setEventRsvp.mockResolvedValue(false);
    await state.setRsvp('e1', 'interested');

    expect(state.rsvp.e1).toBe('going');
    expect(state.rsvpCounts.e1).toEqual({ going: 1, interested: 0 });
  });
});
