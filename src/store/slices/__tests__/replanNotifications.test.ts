import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const syncReminders = vi.fn();
const askNotificationPermission = vi.fn();
vi.mock('../../../services/eventReminders/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/eventReminders/sync')>()),
  syncReminders: (...a: unknown[]) => syncReminders(...a),
  askNotificationPermission: (...a: unknown[]) => askNotificationPermission(...a),
}));

// reloadMapEvents fetches events and the societies catalog together; keep
// both off the network, same as createMapSlice.test.ts.
const fetchMapEvents = vi.fn();
vi.mock('../../../api/mapEvents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/mapEvents')>()),
  fetchMapEvents: (...a: unknown[]) => fetchMapEvents(...a),
}));
vi.mock('../../../api/societies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/societies')>()),
  fetchSocieties: vi.fn(async () => null),
}));

// setRsvp's write and the events-load's attendance fetch, both off the
// network — a new RSVP answer is exercised here too (askNotificationPermission).
const setEventRsvp = vi.fn();
const fetchEventRsvps = vi.fn();
vi.mock('../../../api/eventRsvp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/eventRsvp')>()),
  setEventRsvp: (...a: unknown[]) => setEventRsvp(...a),
  fetchEventRsvps: (...a: unknown[]) => fetchEventRsvps(...a),
}));

// loadFollows() calls getUserParams() (via loadFollowedList) for real; off the
// network here — resolving null just means "IS hasn't confirmed identity
// yet," which still settles followsLoaded, exactly like the real boot race.
const mockGetUserParams = vi.fn();
vi.mock('../../../utils/userParams', () => ({
  getUserParams: (...a: unknown[]) => mockGetUserParams(...a),
}));

import { useAppStore } from '../../useAppStore';
import { DEFAULT_PREFS } from '../createFollowSlice';
import { STORAGE_KEY, MUTED_KEY } from '../follows/loadFollows';
import { IndexedDBService } from '../../../services/storage';
import type { MapEvent } from '../../../types/events';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// The "cold-boot hydration race" tests exercise the REAL loadFollows(), which
// reads follows AND mutes off disk and overwrites whatever `useAppStore.
// setState({ followed/muted: [...] })` set — so, unlike the other tests in
// this file, they need real IndexedDB records to read back, on the real
// fake-indexeddb backing this environment. That store persists across every
// test in this file (an earlier `toggleMute('esn')` test really writes
// MUTED_KEY), so each of these tests seeds both keys itself.
const seedFollows = (followed: string[], muted: string[] = []) =>
  Promise.all([
    IndexedDBService.set('meta', STORAGE_KEY, followed),
    IndexedDBService.set('meta', MUTED_KEY, muted),
  ]);

function ev(overrides: Partial<MapEvent> = {}): MapEvent {
  return {
    id: 'ev-1',
    title: 'Pub Quiz',
    url: '',
    date: '2026-09-29',
    endDate: null,
    time: '19:00',
    location: 'Q01',
    imageUrl: null,
    organizerKey: 'mendelu',
    societyId: 'esn',
    coord: null,
    roomCode: null,
    venueKind: 'campus',
    category: 'quiz',
    createdAt: null,
    ...overrides,
  };
}

describe('replanNotifications', () => {
  beforeEach(() => {
    // Digests fire at a fixed LOCAL hour and "tomorrow" is a local calendar
    // day, so only Date is faked — real timers keep fake-indexeddb's own
    // scheduling (and every `flush()` in this file) working normally.
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 12, 0, 0), toFake: ['Date'] });
    syncReminders.mockReset().mockResolvedValue(undefined);
    askNotificationPermission.mockReset().mockResolvedValue('granted');
    fetchMapEvents.mockReset().mockResolvedValue([]);
    fetchEventRsvps.mockReset().mockResolvedValue({ counts: {}, ok: true });
    setEventRsvp.mockReset().mockResolvedValue(true);
    mockGetUserParams.mockReset().mockResolvedValue(null);
    useAppStore.setState({
      followed: [],
      followsLoaded: false,
      followsResolved: true,
      muted: [],
      notifyPrefs: DEFAULT_PREFS,
      rsvp: {},
      rsvpCounts: {},
      // Most tests below are about re-planning after an action, not the boot
      // race itself — start them past the hydration guard (see "cold-boot
      // hydration race" below, which overrides these back to false).
      rsvpLoaded: true,
      mapEvents: [],
      mapEventsLoaded: true,
      mapEventsFetchedAt: null,
      language: 'cz',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not run before followsLoaded is true — a cold boot must not cancel every pending reminder', () => {
    useAppStore.setState({ followsLoaded: false, followed: ['esn'], mapEvents: [ev()] });

    useAppStore.getState().replanNotifications();

    expect(syncReminders).not.toHaveBeenCalled();
  });

  it("plans one digest notification for a followed society's event tomorrow", () => {
    useAppStore.setState({
      followsLoaded: true,
      notifySettingsRead: true,
      followed: ['esn'],
      mapEvents: [ev()],
    });

    useAppStore.getState().replanNotifications();

    expect(syncReminders).toHaveBeenCalledTimes(1);
    const [planned] = syncReminders.mock.calls[0] as [Array<{ kind: string }>];
    expect(planned).toHaveLength(1);
    expect(planned[0]?.kind).toBe('digest');
  });

  it('toggleMute drops the digest on the next replan', async () => {
    useAppStore.setState({
      followsLoaded: true,
      notifySettingsRead: true,
      followed: ['esn'],
      mapEvents: [ev()],
    });
    useAppStore.getState().replanNotifications();
    expect(syncReminders).toHaveBeenCalledTimes(1);
    syncReminders.mockClear();

    await useAppStore.getState().toggleMute('esn');

    expect(syncReminders).toHaveBeenCalledWith([]);
  });

  // Same id and same fire time, different text: the reconcile can only replace
  // the pending digest if the plan actually carries the new wording.
  it('muting one of two societies changes the pending digest text', async () => {
    useAppStore.setState({
      followsLoaded: true,
      notifySettingsRead: true,
      followed: ['esn', 'isc'],
      mapEvents: [ev(), ev({ id: 'ev-isc', title: 'Board games', societyId: 'isc' })],
    });
    useAppStore.getState().replanNotifications();
    await useAppStore.getState().toggleMute('isc');

    const digests = syncReminders.mock.calls.map(
      (c) => (c[0] as Array<{ kind: string; id: number; at: number; title: string }>)[0]
    );
    expect(digests).toHaveLength(2);
    const [before, after] = digests;
    expect(after?.id).toBe(before?.id);
    expect(after?.at).toBe(before?.at);
    expect(before?.title).toContain('Board games');
    expect(after?.title).not.toContain('Board games');
    expect(after?.title).toContain('Pub Quiz');
  });

  it('setRsvp on a new answer asks for notification permission and replans', async () => {
    useAppStore.setState({
      followsLoaded: true,
      notifySettingsRead: true,
      followed: [],
      mapEvents: [ev({ id: 'ev-2', date: '2026-09-29', time: '19:00' })],
    });
    syncReminders.mockClear();

    await useAppStore.getState().setRsvp('ev-2', 'going');
    await flush();

    expect(askNotificationPermission).toHaveBeenCalledTimes(1);
    expect(syncReminders).toHaveBeenCalled();
    // The RSVP ping is in the plan actually synced.
    const calledWithRsvp = syncReminders.mock.calls.some((c) =>
      (c[0] as Array<{ eventId: string }>).some((n) => n.eventId === 'ev-2')
    );
    expect(calledWithRsvp).toBe(true);
  });

  it('a successful reloadMapEvents triggers a replan', async () => {
    useAppStore.setState({
      followsLoaded: true,
      notifySettingsRead: true,
      followed: ['esn'],
      mapEvents: [],
    });
    fetchMapEvents.mockResolvedValue([ev()]);
    syncReminders.mockClear();

    await useAppStore.getState().reloadMapEvents();

    expect(syncReminders).toHaveBeenCalledTimes(1);
    expect(syncReminders.mock.calls[0]?.[0]).toHaveLength(1);
    // reloadMapEvents' own loadRsvps call is detached — drain it before the
    // next test starts, or its eventual `set({ rsvpLoaded: true })` lands
    // during a later test's setup and corrupts it.
    await flush();
  });

  // The actual boot race (src/store/useAppStore.ts, Tier 2): `loadMapEvents()`
  // fires the network fetch and `loadFollows()` fires right after it, both
  // unawaited. `loadFollows()` is two IDB reads and usually resolves first —
  // its own `replanNotifications()` call must not reconcile from
  // `mapEvents: []`/`rsvp: {}` just because `followsLoaded` alone went true.
  // Modeled with independent, separately-controlled promises for the network
  // fetch and the RSVP hydration read — not one `setState` standing in for
  // both — because the bug was specifically about these resolving out of
  // step with each other.
  describe('cold-boot hydration race', () => {
    it('does not call syncReminders while events/RSVP have not hydrated, even once followsLoaded is true', async () => {
      await seedFollows(['esn']);
      let resolveEvents!: (v: MapEvent[] | null) => void;
      fetchMapEvents.mockImplementation(
        () =>
          new Promise((r) => {
            resolveEvents = r;
          })
      );
      useAppStore.setState({
        followsLoaded: false,
        mapEventsLoaded: false,
        rsvpLoaded: false,
        followed: [],
      });

      // Fired in boot order, both unawaited — the network fetch is left
      // hanging on purpose.
      const mapLoad = useAppStore.getState().loadMapEvents();
      await useAppStore.getState().loadFollows();

      expect(useAppStore.getState().followsLoaded).toBe(true);
      expect(useAppStore.getState().mapEventsLoaded).toBe(false);
      expect(useAppStore.getState().rsvpLoaded).toBe(false);
      expect(syncReminders).not.toHaveBeenCalled();

      // Let the pending fetch settle so it can't leak into a later test.
      resolveEvents([]);
      await mapLoad;
      await flush();
    });

    it('reconciles exactly once, with the full plan, once follows/events/RSVP have all hydrated', async () => {
      await seedFollows(['esn']);
      fetchMapEvents.mockResolvedValue([ev()]);
      fetchEventRsvps.mockResolvedValue({ counts: {}, ok: true });
      useAppStore.setState({
        followsLoaded: false,
        mapEventsLoaded: false,
        rsvpLoaded: false,
        followed: [],
      });

      const mapLoad = useAppStore.getState().loadMapEvents();
      const followsLoad = useAppStore.getState().loadFollows();
      await Promise.all([mapLoad, followsLoad]);
      // loadRsvps is detached from reloadMapEvents, so its own settling — and
      // the replan it triggers — needs a further tick past both of the above.
      await flush();

      expect(useAppStore.getState().followsLoaded).toBe(true);
      expect(useAppStore.getState().mapEventsLoaded).toBe(true);
      expect(useAppStore.getState().rsvpLoaded).toBe(true);
      expect(syncReminders).toHaveBeenCalledTimes(1);
      expect(syncReminders.mock.calls[0]?.[0]).toHaveLength(1);
    });

    // Fix round 1, second pass: the plan is built from the student's own
    // answers and the events, never from the server's counts, so a failed
    // counts fetch must not stop the digest being scheduled for the session.
    it('still reconciles with the full plan when the counts fetch fails but the disk read succeeds', async () => {
      await seedFollows(['esn']);
      fetchMapEvents.mockResolvedValue([ev()]);
      fetchEventRsvps.mockResolvedValue({ counts: {}, ok: false });
      useAppStore.setState({
        followsLoaded: false,
        mapEventsLoaded: false,
        rsvpLoaded: false,
        followed: [],
      });

      const mapLoad = useAppStore.getState().loadMapEvents();
      const followsLoad = useAppStore.getState().loadFollows();
      await Promise.all([mapLoad, followsLoad]);
      await flush();

      expect(useAppStore.getState().rsvpLoaded).toBe(true);
      expect(syncReminders).toHaveBeenCalledTimes(1);
      const [planned] = syncReminders.mock.calls[0] as [Array<{ kind: string }>];
      expect(planned.some((n) => n.kind === 'digest')).toBe(true);
    });

    it('never calls syncReminders with an empty plan when IDB resolves before the network fetch', async () => {
      await seedFollows(['esn']);
      let resolveEvents!: (v: MapEvent[] | null) => void;
      fetchMapEvents.mockImplementation(
        () =>
          new Promise((r) => {
            resolveEvents = r;
          })
      );
      fetchEventRsvps.mockResolvedValue({ counts: {}, ok: true });
      useAppStore.setState({
        followsLoaded: false,
        mapEventsLoaded: false,
        rsvpLoaded: false,
        followed: [],
      });

      const mapLoad = useAppStore.getState().loadMapEvents();
      // IDB resolves well before the network fetch does — the exact ordering
      // the CRITICAL finding described.
      await useAppStore.getState().loadFollows();
      await flush();

      expect(syncReminders).not.toHaveBeenCalledWith([]);

      resolveEvents([ev()]);
      await mapLoad;
      await flush();

      expect(syncReminders).not.toHaveBeenCalledWith([]);
      expect(syncReminders).toHaveBeenCalledTimes(1);
    });
  });

  // Dropped from the old planner suite's migration (Task 3) and restored
  // here: the digest and the RSVP body are both built in the app's current
  // language at planning time.
  describe("follows the student's language", () => {
    // Followed+unmuted for the digest, RSVP'd with a readable time for the
    // ping — one event covers both notification kinds.
    const bilingualEvent = ev({ id: 'ev-3', date: '2026-09-29', time: '19:00' });

    function plan() {
      useAppStore.getState().replanNotifications();
      const [planned] = syncReminders.mock.calls.at(-1) as [
        Array<{ kind: string; title: string; body: string }>,
      ];
      return {
        digest: planned.find((n) => n.kind === 'digest'),
        rsvp: planned.find((n) => n.kind === 'rsvp'),
      };
    }

    it('builds Czech text when the app language is cz', () => {
      useAppStore.setState({
        followsLoaded: true,
        notifySettingsRead: true,
        followed: ['esn'],
        mapEvents: [bilingualEvent],
        rsvp: { 'ev-3': 'going' },
        language: 'cz',
      });

      const { digest, rsvp } = plan();

      expect(digest?.title).toContain('Zítra:');
      expect(rsvp?.body).toContain('Za 2 hodiny');
    });

    // A pending digest keeps its id and time across a language switch, so
    // only a replan carrying the new wording can replace it on the device.
    it('switching the language replans in the new language', async () => {
      useAppStore.setState({
        followsLoaded: true,
        notifySettingsRead: true,
        followed: ['esn'],
        mapEvents: [bilingualEvent],
        rsvp: { 'ev-3': 'going' },
        language: 'cz',
      });
      syncReminders.mockClear();

      await useAppStore.getState().setLanguage('en');

      const [planned] = syncReminders.mock.calls.at(-1) as [Array<{ kind: string; title: string }>];
      expect(planned.find((n) => n.kind === 'digest')?.title).toContain('Tomorrow:');
      await useAppStore.getState().setLanguage('cz');
    });

    it('a language read back from disk (another tab) replans too', async () => {
      useAppStore.setState({
        followsLoaded: true,
        notifySettingsRead: true,
        followed: ['esn'],
        mapEvents: [bilingualEvent],
        language: 'cz',
      });
      await IndexedDBService.set('meta', 'reis_language', 'en');
      syncReminders.mockClear();

      await useAppStore.getState().loadLanguage();

      const [planned] = syncReminders.mock.calls.at(-1) as [Array<{ kind: string; title: string }>];
      expect(planned.find((n) => n.kind === 'digest')?.title).toContain('Tomorrow:');
      await IndexedDBService.set('meta', 'reis_language', 'cz');
      useAppStore.setState({ language: 'cz' });
    });

    it('builds English text when the app language is en', () => {
      useAppStore.setState({
        followsLoaded: true,
        notifySettingsRead: true,
        followed: ['esn'],
        mapEvents: [bilingualEvent],
        rsvp: { 'ev-3': 'going' },
        language: 'en',
      });

      const { digest, rsvp } = plan();

      expect(digest?.title).toContain('Tomorrow:');
      expect(rsvp?.body).toContain('In 2 hours');
    });
  });
});
