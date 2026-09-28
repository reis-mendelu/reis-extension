import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const syncReminders = vi.fn();
vi.mock('../../../services/eventReminders/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/eventReminders/sync')>()),
  syncReminders: (...a: unknown[]) => syncReminders(...a),
}));

vi.mock('../../../utils/userParams', () => ({ getUserParams: () => Promise.resolve(null) }));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { useAppStore } from '../../useAppStore';
import { DEFAULT_PREFS } from '../createFollowSlice';
import { STORAGE_KEY, CHOSEN_KEY, MUTED_KEY } from '../follows/loadFollows';
import { IndexedDBService } from '../../../services/storage';
import type { MapEvent } from '../../../types/events';

// Tomorrow evening relative to the faked "now" below, so the full plan holds
// a digest for ESN — the one a mute is meant to silence.
function ev(): MapEvent {
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
  };
}

type Call = [Array<{ kind: string; eventId: string }>, unknown?, unknown?];

/**
 * While the notification settings are unread, memory holds the defaults: no
 * mutes, every switch on. A plan built from those would schedule what the
 * student muted or switched off, so the replan does nothing at all and what
 * is already pending (planned from the real settings) stays as it is.
 */
describe('replanNotifications while the notification settings are unread', () => {
  let failMutedRead: boolean;

  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 12, 0, 0), toFake: ['Date'] });
    syncReminders.mockReset().mockResolvedValue(undefined);
    await IndexedDBService.set('meta', STORAGE_KEY, ['esn']);
    await IndexedDBService.set('meta', CHOSEN_KEY, true);
    await IndexedDBService.set('meta', MUTED_KEY, ['esn']);
    failMutedRead = true;
    const realGet = IndexedDBService.get.bind(IndexedDBService);
    vi.spyOn(IndexedDBService, 'get').mockImplementation(((store: string, key: string) =>
      failMutedRead && key === MUTED_KEY
        ? Promise.reject(new Error('IDB read failed'))
        : realGet(store as 'meta', key)) as typeof IndexedDBService.get);
    useAppStore.setState({
      followed: [],
      followsLoaded: false,
      followsResolved: false,
      followsListRead: false,
      notifySettingsRead: false,
      muted: [],
      notifyPrefs: DEFAULT_PREFS,
      rsvp: {},
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

  it('a failed read leaves pending untouched and schedules nothing for a muted society', async () => {
    await useAppStore.getState().loadFollows();
    expect(useAppStore.getState().followed).toEqual(['esn']);
    expect(useAppStore.getState().muted).toEqual([]);

    // A memory-only mutation replans too; it must not reconcile either.
    await useAppStore.getState().setNotifyPref('myEvents', true);

    expect(syncReminders).not.toHaveBeenCalled();
  });

  it('the good read that follows replans from the real settings', async () => {
    await useAppStore.getState().loadFollows();
    expect(syncReminders).not.toHaveBeenCalled();

    failMutedRead = false;
    await useAppStore.getState().loadFollows();

    expect(useAppStore.getState().muted).toEqual(['esn']);
    expect(syncReminders).toHaveBeenCalledTimes(1);
    const [planned] = syncReminders.mock.calls[0] as Call;
    expect(planned.filter((p) => p.kind === 'digest')).toEqual([]);
  });
});
