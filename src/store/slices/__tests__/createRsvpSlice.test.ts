import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

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

const askNotificationPermission = vi.fn();
vi.mock('../../../services/eventReminders/sync', () => ({
  askNotificationPermission: (...a: unknown[]) => askNotificationPermission(...a),
}));

import { createRsvpSlice, type RsvpSlice } from '../createRsvpSlice';
import type { MapEvent } from '../../../types/events';

// Writes are chained per event, so even the first one is issued a microtask
// after the tap, and `askNotificationPermission`'s own `.then()` is a further
// detached microtask on top of that. Tests that assert on either have to let
// that turn run; tests that assert on store state do not, because the
// optimistic update is synchronous.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createRsvpSlice', () => {
  // The slice reads mapEvents off the composed store, and now calls
  // `get().replanNotifications()` (a FollowSlice neighbour) instead of
  // planning/syncing reminders itself — both are supplied the same way.
  let state: RsvpSlice & {
    mapEvents: MapEvent[];
    notifyPrefs: { myEvents: boolean; followedEvents: boolean; newEvents: boolean };
    replanNotifications: Mock;
    setNotifyPermission: Mock;
  };
  let set: Mock & Parameters<typeof createRsvpSlice>[0];
  let get: Mock & Parameters<typeof createRsvpSlice>[1];

  beforeEach(() => {
    idb.clear();
    fetchEventRsvps.mockReset().mockResolvedValue({ counts: {}, ok: true });
    setEventRsvp.mockReset().mockResolvedValue(true);
    askNotificationPermission.mockReset().mockResolvedValue('granted');
    set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state) as unknown as typeof get;
    state = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createRsvpSlice(set, get, {} as any),
      mapEvents: [],
      notifyPrefs: { myEvents: true, followedEvents: true, newEvents: true },
      replanNotifications: vi.fn(),
      setNotifyPermission: vi.fn(),
    };
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

    // An empty feed (every event cancelled, or none published yet) is still a
    // settled read. Returning before rsvpLoaded left the replan gate shut for
    // the whole session, so pings and digests for vanished events still fired.
    it('an empty feed still reads the device answers, opens the gate and replans', async () => {
      idb.set('event_rsvps_mine', { gone: 'going' });
      await state.loadRsvps([]);
      expect(fetchEventRsvps).not.toHaveBeenCalled();
      expect(state.rsvpLoaded).toBe(true);
      expect(state.replanNotifications).toHaveBeenCalledTimes(1);
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

    // Planning and syncing the actual reminder content now lives in
    // `replanNotifications` (tested on its own); this slice's job is only to
    // trigger a replan at the right moments.
    it('replans when the student says they are going', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      expect(state.replanNotifications).toHaveBeenCalled();
    });

    // Backing out has to take the notification with it.
    it('replans again when the student un-RSVPs', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      state.replanNotifications.mockClear();
      await state.setRsvp('e1', 'going'); // tapping the active choice withdraws
      await flush();
      expect(state.replanNotifications).toHaveBeenCalled();
    });

    it('still replans off the back of a refused write', async () => {
      state.mapEvents = [party] as never;
      setEventRsvp.mockResolvedValue(false);
      await state.setRsvp('e1', 'going');
      await flush();
      expect(state.replanNotifications).toHaveBeenCalled();
    });

    // Reopening the app restores the student's answers, so their reminders have
    // to come back with them — on a fresh install there is nothing pending.
    it('replans for answers loaded from the backend', async () => {
      state.mapEvents = [party] as never;
      idb.set('event_rsvps_mine', { e1: 'going' });
      fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 1, interested: 0 } }, ok: true });
      await state.loadRsvps(['e1']);
      expect(state.replanNotifications).toHaveBeenCalled();
    });

    // The first answer for an event is the moment permission is earned — the
    // prompt appears the first time the student asks to be reminded of
    // something, not before they've touched a single event.
    it('asks for notification permission on a new answer, then replans', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      expect(askNotificationPermission).toHaveBeenCalledTimes(1);
      expect(state.setNotifyPermission).toHaveBeenCalledWith('granted');
      expect(state.replanNotifications).toHaveBeenCalled();
    });

    // Ruling: an event with no readable start time (all-day, or a time IS
    // wrote in some other shape) gets no RSVP ping, so answering it has
    // nothing to earn permission for — the prompt would be a promise the
    // app then does not keep.
    it.each([
      ['no time', { time: null }],
      ['an unreadable time', { time: 'večer' }],
    ])('does not ask on a new answer to an event with %s', async (_label, over) => {
      state.mapEvents = [{ ...party, ...over }] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      expect(askNotificationPermission).not.toHaveBeenCalled();
    });

    // A start `hoursAhead` from now, as the date and HH:MM an event carries.
    const startingIn = (hoursAhead: number) => {
      const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      };
    };

    // The ping fires two hours before the start: an event one hour out has
    // no ping left to schedule, so the prompt would promise nothing.
    it('does not ask when the reminder time has already passed', async () => {
      state.mapEvents = [{ ...party, ...startingIn(1) }] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      expect(askNotificationPermission).not.toHaveBeenCalled();
    });

    it('asks when the reminder time is still ahead', async () => {
      state.mapEvents = [{ ...party, ...startingIn(3) }] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      expect(askNotificationPermission).toHaveBeenCalledTimes(1);
    });

    // With "Připomínky mých akcí" off the planner schedules no ping at all.
    it('does not ask when the student has turned RSVP reminders off', async () => {
      state.mapEvents = [party] as never;
      state.notifyPrefs = { myEvents: false, followedEvents: true, newEvents: true };
      await state.setRsvp('e1', 'going');
      await flush();
      expect(askNotificationPermission).not.toHaveBeenCalled();
    });

    it('does not ask for an event it cannot find', async () => {
      state.mapEvents = [] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      expect(askNotificationPermission).not.toHaveBeenCalled();
    });

    // Switching Going -> Interested is a CHANGE, not a new answer — the
    // student already answered the OS prompt once for this event.
    it('does not ask again when an existing answer merely changes', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      askNotificationPermission.mockClear();
      await state.setRsvp('e1', 'interested');
      await flush();
      expect(askNotificationPermission).not.toHaveBeenCalled();
    });

    // Un-RSVPing is a withdrawal, not a new answer — nothing to earn
    // permission for.
    it('does not ask when the student un-RSVPs', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      await flush();
      askNotificationPermission.mockClear();
      await state.setRsvp('e1', 'going'); // tapping the active choice withdraws
      await flush();
      expect(askNotificationPermission).not.toHaveBeenCalled();
    });
  });
});

/**
 * Two failure modes reviewers caught, both of which quietly destroy state.
 */
describe('createRsvpSlice — failure handling', () => {
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
  let state: RsvpSlice & {
    mapEvents: MapEvent[];
    notifyPrefs: { myEvents: boolean; followedEvents: boolean; newEvents: boolean };
    replanNotifications: Mock;
    setNotifyPermission: Mock;
  };
  let set: Mock & Parameters<typeof createRsvpSlice>[0];
  let get: Mock & Parameters<typeof createRsvpSlice>[1];

  beforeEach(() => {
    idb.clear();
    fetchEventRsvps.mockReset().mockResolvedValue({ counts: {}, ok: true });
    setEventRsvp.mockReset().mockResolvedValue(true);
    askNotificationPermission.mockReset().mockResolvedValue('granted');
    set = vi.fn((u) => {
      const p = typeof u === 'function' ? u(state) : u;
      state = { ...state, ...p };
    });
    get = vi.fn(() => state) as unknown as typeof get;
    state = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createRsvpSlice(set, get, {} as any),
      mapEvents: [party] as never,
      notifyPrefs: { myEvents: true, followedEvents: true, newEvents: true },
      replanNotifications: vi.fn(),
      setNotifyPermission: vi.fn(),
    };
  });

  // This used to read "does not touch reminders when the load failed" and
  // assert the opposite — but its setup was never a failed LOAD, only a
  // failed COUNTS fetch, with the disk read (which is what the plan is
  // actually built from) succeeding. Fix round 1, second pass: the reminder
  // plan is never built from a count, so it must still reconcile here — the
  // real "disk read failed" case is covered separately below (`still loads
  // counts when the local answers cannot be read`).
  it('still replans when only the counts request failed', async () => {
    idb.set('event_rsvps_mine', { e1: 'going' });
    fetchEventRsvps.mockResolvedValue({ counts: {}, ok: false });
    await state.loadRsvps(['e1']);
    expect(state.replanNotifications).toHaveBeenCalled();
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
    expect(state.replanNotifications).not.toHaveBeenCalled();
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

  // A superseded write the server ACCEPTED still has to reach disk. If the app
  // dies before the newer write settles, storage would otherwise hold an older
  // answer than the server does, and the next launch restores that
  // disagreement — plus a reminder built from it.
  it('persists a superseded write that the server accepted', async () => {
    let landGoing!: (v: boolean) => void;
    setEventRsvp
      .mockImplementationOnce(() => new Promise<boolean>((r) => (landGoing = r)))
      // The newer Interested never settles — the app dies first.
      .mockImplementationOnce(() => new Promise<boolean>(() => {}));

    const first = state.setRsvp('e1', 'going');
    await flush();
    void state.setRsvp('e1', 'interested');

    landGoing(true);
    await first;
    await flush();

    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going' });
  });

  // loadRsvps is detached and its IndexedDB read is awaited, so a tap can settle
  // during that read. Seeding unconditionally afterwards would replace the
  // freshly confirmed answer with the disk value it just superseded, and the
  // next failed write would roll the card back to that obsolete answer.
  it('does not let a slow startup load overwrite an answer confirmed meanwhile', async () => {
    const { IndexedDBService } = await import('../../../services/storage');
    let finishRead!: (v: Record<string, string>) => void;
    vi.mocked(IndexedDBService.get).mockImplementationOnce(
      () => new Promise((r) => (finishRead = r as (v: Record<string, string>) => void))
    );
    fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 0, interested: 1 } }, ok: true });

    const loading = state.loadRsvps(['e1']);
    await flush();

    // The student switches to Interested and the server accepts it, all while
    // the startup read is still out.
    setEventRsvp.mockResolvedValueOnce(true);
    await state.setRsvp('e1', 'interested');
    await flush();

    // Only now does the read return, carrying the older answer.
    finishRead({ e1: 'going' });
    await loading;

    // A later write fails: the rollback must land on Interested, not on the
    // stale Going the load was carrying.
    setEventRsvp.mockResolvedValue(false);
    await state.setRsvp('e1', 'going');
    await flush();

    expect(state.rsvp.e1).toBe('interested');
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'interested' });
  });

  // A withdrawal that settles during the detached load removes its event from
  // the live map entirely. Spreading the stored map underneath would put the
  // answer back — and refreshReminders would then schedule a reminder for an
  // event the student just took back, while disk already says otherwise.
  it('does not resurrect an answer withdrawn while the load was running', async () => {
    idb.set('event_rsvps_mine', { e1: 'going' });

    let finishFetch!: (v: { counts: Record<string, unknown>; ok: boolean }) => void;
    fetchEventRsvps.mockImplementationOnce(() => new Promise((r) => (finishFetch = r)));
    const loading = state.loadRsvps(['e1']);
    await flush();

    // The student withdraws, and the server accepts it, mid-load.
    state.rsvp = { e1: 'going' };
    setEventRsvp.mockResolvedValueOnce(true);
    await state.setRsvp('e1', 'going'); // tapping the active choice withdraws
    await flush();
    expect(state.rsvp.e1).toBeUndefined();

    finishFetch({ counts: { e1: { going: 0, interested: 0 } }, ok: true });
    await loading;

    expect(state.rsvp.e1).toBeUndefined();
    expect(idb.get('event_rsvps_mine')).toEqual({});
  });

  // The count request is issued before a tap and answered after it. Merging the
  // older response back would drop the student's own accepted answer off the
  // card until some later load happened to refresh it.
  it('does not let a stale load overwrite counts for an event answered meanwhile', async () => {
    let finishFetch!: (v: { counts: Record<string, unknown>; ok: boolean }) => void;
    fetchEventRsvps.mockImplementationOnce(() => new Promise((r) => (finishFetch = r)));
    const loading = state.loadRsvps(['e1', 'e2']);
    await flush();

    setEventRsvp.mockResolvedValueOnce(true);
    await state.setRsvp('e1', 'going');
    await flush();
    expect(state.rsvpCounts.e1).toEqual({ going: 1, interested: 0 });

    // The load finally answers, carrying the pre-tap numbers.
    finishFetch({
      counts: { e1: { going: 0, interested: 0 }, e2: { going: 5, interested: 2 } },
      ok: true,
    });
    await loading;

    // e1 keeps the count that includes this device's accepted answer…
    expect(state.rsvpCounts.e1).toEqual({ going: 1, interested: 0 });
    // …while e2, untouched by this session, takes the server's numbers.
    expect(state.rsvpCounts.e2).toEqual({ going: 5, interested: 2 });
  });

  // The withdrawal starts BEFORE the load, so its revision bump is already
  // inside the load's baseline snapshot and reads as unchanged. Its persist has
  // not flushed either, so disk still holds the old answer — hydration would put
  // it straight back on the card and schedule a reminder for it.
  it('does not hydrate over a withdrawal that began before the load', async () => {
    idb.set('event_rsvps_mine', { e1: 'going' });
    state.rsvp = { e1: 'going' };

    // Withdrawal issued first, still unanswered.
    let settleWithdraw!: (v: boolean) => void;
    setEventRsvp.mockImplementationOnce(() => new Promise<boolean>((r) => (settleWithdraw = r)));
    const withdrawing = state.setRsvp('e1', 'going'); // tapping the active choice
    await flush();
    expect(state.rsvp.e1).toBeUndefined();

    // The load starts now: the revision is already bumped, and disk still says
    // 'going' because the withdrawal has not settled.
    fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 0, interested: 0 } }, ok: true });
    await state.loadRsvps(['e1']);

    expect(state.rsvp.e1).toBeUndefined();

    settleWithdraw(true);
    await withdrawing;
    await flush();

    expect(state.rsvp.e1).toBeUndefined();
    expect(idb.get('event_rsvps_mine')).toEqual({});
  });

  // The mirror of the case above, and the reason `confirmed` seeds from disk
  // even for an event with a write in flight: a returning student changes a
  // stored answer before the startup read lands, and the write fails. The
  // server still holds the previous answer, so the rollback has to restore it —
  // not clear the card and cancel a reminder that is still valid.
  it('rolls back to the stored answer when a write fails before the load lands', async () => {
    idb.set('event_rsvps_mine', { e1: 'going' });
    state.rsvp = { e1: 'going' };

    let finishRead!: (v: Record<string, string>) => void;
    const { IndexedDBService } = await import('../../../services/storage');
    vi.mocked(IndexedDBService.get).mockImplementationOnce(
      () => new Promise((r) => (finishRead = r as (v: Record<string, string>) => void))
    );
    fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 1, interested: 0 } }, ok: true });
    const loading = state.loadRsvps(['e1']);
    await flush();

    // The student switches to Interested before the read returns, and it fails.
    setEventRsvp.mockResolvedValueOnce(false);
    await state.setRsvp('e1', 'interested');

    finishRead({ e1: 'going' });
    await loading;
    await flush();

    // The server never stopped holding Going, so that is what the card shows.
    expect(state.rsvp.e1).toBe('going');
    expect(idb.get('event_rsvps_mine')).toEqual({ e1: 'going' });
  });

  /**
   * The calendar blocks and the reminders part company on `ok`.
   *
   * `ok` says only whether the server's COUNTS arrived. The blocks are planned
   * from the student's own answers and the events, neither of which is a count,
   * so a load where the disk succeeded and the count request failed must still
   * reconcile them. Gating both on `ok` left a withdrawn or newly answered
   * event's block stale until something else happened. Raised in review.
   */
  describe('reconciling after a load', () => {
    const event = {
      id: 'e1',
      title: 'Flag Party',
      date: '2026-09-21',
      time: '19:00',
      location: 'Zlatá loď',
    } as MapEvent;

    // The calendar slice is a neighbour in the composed store, so the test
    // supplies it the same way it supplies `mapEvents`.
    const withCalendar = (existing: unknown[] = []) => {
      const added: string[] = [];
      const removeCalendarCustomEvent = vi.fn(async () => {});
      Object.assign(state, {
        mapEvents: [event],
        customEvents: existing,
        addCalendarCustomEvent: vi.fn(async (e: { id: string }) => void added.push(e.id)),
        updateCalendarCustomEvent: vi.fn(async () => {}),
        removeCalendarCustomEvent,
      });
      return { added, removeCalendarCustomEvent };
    };

    it('still writes the block when the counts fail but the disk answers arrive', async () => {
      idb.set('event_rsvps_mine', { e1: 'interested' });
      fetchEventRsvps.mockResolvedValue({ counts: {}, ok: false });
      const { added } = withCalendar();

      await state.loadRsvps(['e1']);
      await new Promise((r) => setTimeout(r, 0));

      expect(added).toEqual(['rsvp:e1']);
    });

    // Fix round 1, second pass: the reminder plan is built from the answers
    // and the events, never from a count — same reasoning as the calendar
    // block above, which already gated on `stored` alone. Gating the replan
    // on `ok` too meant a session whose counts request happened to fail never
    // got its digest scheduled, even though the answers had loaded fine.
    it('still replans when the counts fail but the disk answers arrive', async () => {
      idb.set('event_rsvps_mine', { e1: 'interested' });
      fetchEventRsvps.mockResolvedValue({ counts: {}, ok: false });
      withCalendar();

      await state.loadRsvps(['e1']);

      expect(state.replanNotifications).toHaveBeenCalled();
    });

    it('reconciles nothing when the disk read itself fails', async () => {
      fetchEventRsvps.mockResolvedValue({ counts: {}, ok: true });
      const { added, removeCalendarCustomEvent } = withCalendar([
        {
          id: 'rsvp:e1',
          title: 'Flag Party',
          date: '20260921',
          startTime: '19:00',
          endTime: '20:30',
        },
      ]);

      // A real read failure, with a real event id. Raised in review: the first
      // version of this called `loadRsvps([])`, which returns before it ever
      // touches IndexedDB — so it asserted the early return and proved nothing
      // about the guard it is named after.
      const { IndexedDBService } = await import('../../../services/storage');
      vi.mocked(IndexedDBService.get).mockRejectedValueOnce(new Error('IDB unavailable'));

      await state.loadRsvps(['e1']);
      await new Promise((r) => setTimeout(r, 0));

      // An unread disk is an empty plan, not "answered nothing" — reconciling
      // against it would delete a block for an event still being attended.
      expect(added).toEqual([]);
      expect(removeCalendarCustomEvent).not.toHaveBeenCalled();
    });
  });
});
