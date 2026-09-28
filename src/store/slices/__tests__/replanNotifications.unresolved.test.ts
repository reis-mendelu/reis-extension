import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const syncReminders = vi.fn();
vi.mock('../../../services/eventReminders/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/eventReminders/sync')>()),
  syncReminders: (...a: unknown[]) => syncReminders(...a),
}));

const mockGetUserParams = vi.fn();
vi.mock('../../../utils/userParams', () => ({
  getUserParams: (...a: unknown[]) => mockGetUserParams(...a),
}));

import { useAppStore } from '../../useAppStore';
import { DEFAULT_PREFS } from '../createFollowSlice';
import { STORAGE_KEY } from '../follows/loadFollows';
import { IndexedDBService } from '../../../services/storage';
import type { MapEvent } from '../../../types/events';

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

type Call = [Array<{ kind: string; eventId: string }>, unknown?, { keepDigests?: boolean }?];

/**
 * `followsLoaded` settles even when the follow list could not be resolved
 * (the boot race, or a failed IndexedDB read), and `followed` is then `[]`.
 * Reconciling from that would cancel every pending digest until the retry
 * lands; skipping the replan would leave RSVP pings unreconciled for a
 * student whose list never resolves. So the pings are planned and the
 * digests already pending are kept.
 */
describe('replanNotifications while the follow list is unresolved', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 12, 0, 0), toFake: ['Date'] });
    syncReminders.mockReset().mockResolvedValue(undefined);
    mockGetUserParams.mockReset().mockResolvedValue(null);
    useAppStore.setState({
      followed: [],
      followsLoaded: true,
      followsResolved: false,
      muted: [],
      notifyPrefs: DEFAULT_PREFS,
      rsvp: { 'ev-1': 'going' },
      rsvpLoaded: true,
      mapEvents: [ev()],
      mapEventsLoaded: true,
      language: 'cz',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('plans the RSVP ping and keeps the pending digests', () => {
    useAppStore.getState().replanNotifications();

    expect(syncReminders).toHaveBeenCalledTimes(1);
    const [planned, , opts] = syncReminders.mock.calls[0] as Call;
    expect(planned.map((p) => p.kind)).toEqual(['rsvp']);
    expect(opts).toEqual({ keepDigests: true });
  });

  it('reconciles digests normally once the list has resolved', () => {
    useAppStore.setState({ followsResolved: true, followed: ['esn'] });

    useAppStore.getState().replanNotifications();

    const [planned, , opts] = syncReminders.mock.calls[0] as Call;
    expect(planned.map((p) => p.kind).sort()).toEqual(['digest', 'rsvp']);
    expect(opts?.keepDigests).toBeFalsy();
  });

  // The realistic trigger: the saved list exists, but the read of it fails.
  it('a failed read of the saved list keeps the pending digests', async () => {
    const realGet = IndexedDBService.get.bind(IndexedDBService);
    vi.spyOn(IndexedDBService, 'get').mockImplementation(((store: string, key: string) =>
      key === STORAGE_KEY
        ? Promise.reject(new Error('IDB read failed'))
        : realGet(store as 'meta', key)) as typeof IndexedDBService.get);
    useAppStore.setState({ followsLoaded: false });

    await useAppStore.getState().loadFollows();

    expect(useAppStore.getState().followsResolved).toBe(false);
    const [, , opts] = syncReminders.mock.calls.at(-1) as Call;
    expect(opts).toEqual({ keepDigests: true });
  });

  // A hand-made choice is an answer: the digests follow it from then on.
  it('toggleFollow after an unresolved load resolves the list', async () => {
    await useAppStore.getState().toggleFollow('esn');

    expect(useAppStore.getState().followsResolved).toBe(true);
    const [planned, , opts] = syncReminders.mock.calls.at(-1) as Call;
    expect(opts?.keepDigests).toBeFalsy();
    expect(planned.some((p) => p.kind === 'digest')).toBe(true);
  });
});
