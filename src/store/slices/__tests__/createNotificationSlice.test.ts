import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotificationSlice } from '../createNotificationSlice';
import type { NotificationSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));
const fetchNotifications = vi.hoisted(() => vi.fn());
vi.mock('../../../services/spolky', () => ({
  fetchNotifications,
  trackNotificationsViewed: vi.fn(),
}));

const CACHED = [{ id: 'old', title: 'Deskovky', body: 'Deskovky', expiresAt: '2026-09-04' }];
const FRESH = [{ id: 'new', title: 'Beseda', body: 'Beseda', expiresAt: '2026-09-20' }];

/**
 * Boot fires `loadNotificationState` (four IndexedDB reads) and
 * `fetchNotifications` (one network call) side by side, neither awaited. The
 * cache is a head start for the seconds before the network answers — it must
 * never be allowed to land on top of an answer that has already arrived.
 */
describe('createNotificationSlice: the cache must not outrank the network', () => {
  let state: NotificationSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createNotificationSlice(set, get, {} as any);
    vi.mocked(IndexedDBService.get).mockImplementation(async (_store, key) =>
      key === 'notifications_cache' ? CACHED : []
    );
  });

  it('shows the cache while nothing better has arrived', async () => {
    await state.loadNotificationState();
    expect(state.notifications.data).toEqual(CACHED);
  });

  it('does not put the cache back over a fetch that already landed', async () => {
    // The order boot cannot guarantee: a warm HTTP response beating four cold
    // IndexedDB reads. Before this, the stale cache won and a student saw an
    // event from a fortnight ago, unread, until the next refetch five minutes
    // later.
    fetchNotifications.mockResolvedValue(FRESH);
    await state.fetchNotifications();
    expect(state.notifications.data).toEqual(FRESH);

    await state.loadNotificationState();

    expect(state.notifications.data).toEqual(FRESH);
  });

  it('still falls back to the cache when the fetch failed', async () => {
    // A failed fetch leaves `status: 'error'` and no data of its own; the cache
    // is then the best answer available, stale or not.
    fetchNotifications.mockRejectedValue(new Error('offline'));
    await state.fetchNotifications();

    await state.loadNotificationState();

    expect(state.notifications.data).toEqual(CACHED);
  });

  it('keeps the cache when the service reports a failure rather than an empty feed', async () => {
    // Supabase reports an error instead of rejecting, so the service cannot
    // throw for it — it answers `null`. Recording that as a successful empty
    // feed wrote `[]` over the cache, and the student's Novinky were gone on
    // this launch and every later one until a fetch happened to succeed.
    fetchNotifications.mockResolvedValue(null);
    await state.fetchNotifications();

    expect(state.notifications.status).toBe('error');
    expect(IndexedDBService.set).not.toHaveBeenCalledWith(
      'meta',
      'notifications_cache',
      expect.anything()
    );

    await state.loadNotificationState();
    expect(state.notifications.data).toEqual(CACHED);
  });

  it('lets a genuinely empty feed empty the screen', async () => {
    // The other half: a feed that has run out has to be able to say so, or the
    // last event of the term would be pinned there for good.
    fetchNotifications.mockResolvedValue([]);
    await state.fetchNotifications();

    expect(state.notifications.status).toBe('success');
    expect(state.notifications.data).toEqual([]);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'notifications_cache', []);
  });

  it('keeps the read and viewed sets whichever way the race went', async () => {
    fetchNotifications.mockResolvedValue(FRESH);
    await state.fetchNotifications();
    vi.mocked(IndexedDBService.get).mockImplementation(async (_store, key) => {
      if (key === 'notifications_cache') return CACHED;
      if (key === 'read_notifications') return ['old'];
      return [];
    });

    await state.loadNotificationState();

    expect(state.notifications.readIds.has('old')).toBe(true);
  });
});
