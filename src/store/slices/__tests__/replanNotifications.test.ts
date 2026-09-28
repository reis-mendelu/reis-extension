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

import { useAppStore } from '../../useAppStore';
import { DEFAULT_PREFS } from '../createFollowSlice';
import type { MapEvent } from '../../../types/events';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    useAppStore.setState({
      followed: [],
      followsLoaded: false,
      followsResolved: true,
      muted: [],
      notifyPrefs: DEFAULT_PREFS,
      rsvp: {},
      rsvpCounts: {},
      mapEvents: [],
      mapEventsLoaded: false,
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
    useAppStore.setState({ followsLoaded: true, followed: ['esn'], mapEvents: [ev()] });

    useAppStore.getState().replanNotifications();

    expect(syncReminders).toHaveBeenCalledTimes(1);
    const [planned] = syncReminders.mock.calls[0] as [Array<{ kind: string }>];
    expect(planned).toHaveLength(1);
    expect(planned[0]?.kind).toBe('digest');
  });

  it('toggleMute drops the digest on the next replan', async () => {
    useAppStore.setState({ followsLoaded: true, followed: ['esn'], mapEvents: [ev()] });
    useAppStore.getState().replanNotifications();
    expect(syncReminders).toHaveBeenCalledTimes(1);
    syncReminders.mockClear();

    await useAppStore.getState().toggleMute('esn');

    expect(syncReminders).toHaveBeenCalledWith([]);
  });

  it('setRsvp on a new answer asks for notification permission and replans', async () => {
    useAppStore.setState({
      followsLoaded: true,
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
    useAppStore.setState({ followsLoaded: true, followed: ['esn'], mapEvents: [] });
    fetchMapEvents.mockResolvedValue([ev()]);
    syncReminders.mockClear();

    await useAppStore.getState().reloadMapEvents();

    expect(syncReminders).toHaveBeenCalledTimes(1);
    expect(syncReminders.mock.calls[0]?.[0]).toHaveLength(1);
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
        followed: ['esn'],
        mapEvents: [bilingualEvent],
        rsvp: { 'ev-3': 'going' },
        language: 'cz',
      });

      const { digest, rsvp } = plan();

      expect(digest?.title).toContain('Zítra:');
      expect(rsvp?.body).toContain('Za 2 hodiny');
    });

    it('builds English text when the app language is en', () => {
      useAppStore.setState({
        followsLoaded: true,
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
