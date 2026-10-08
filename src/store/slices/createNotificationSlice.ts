import type { AppSlice, NotificationSlice } from '../types';
import { fetchNotifications } from '../../services/spolky';
import { trackEventSignal } from '../../api/eventSignals';
import { IndexedDBService } from '../../services/storage';
import { dropPreAudienceRows } from '../../services/spolky/spolkyService';

export const createNotificationSlice: AppSlice<NotificationSlice> = (set, get) => ({
  notifications: {
    data: [],
    readIds: new Set(),
    viewedIds: new Set(),
    seenDeadlineAlertIds: new Set(),
    status: 'idle',
  },

  loadNotificationState: async () => {
    const [readIds, seenIds, cache] = await Promise.all([
      IndexedDBService.get('meta', 'read_notifications'),
      IndexedDBService.get('meta', 'seen_deadline_alerts'),
      IndexedDBService.get('meta', 'notifications_cache'),
    ]);
    // The old post-view dedupe; Seen now keeps its own record (api/eventSignals).
    void IndexedDBService.delete('meta', 'viewed_notifications_analytics');

    set((state) => ({
      notifications: {
        ...state.notifications,
        readIds: new Set(readIds || []),
        seenDeadlineAlertIds: new Set(seenIds || []),
        // A HEAD START, not an answer. Boot fires this and
        // `fetchNotifications` side by side and awaits neither, so on a
        // cold start four IndexedDB reads can finish AFTER a warm HTTP
        // response — and this used to drop the stale cache back on top
        // of it. A student then saw an event from a fortnight ago,
        // unread and highlighted, until the next refetch five minutes
        // later. `success` is the only state that means the network has
        // actually answered; after an error the cache is still the best
        // thing available.
        data:
          state.notifications.status === 'success'
            ? state.notifications.data
            : dropPreAudienceRows(cache || []),
      },
    }));
  },

  fetchNotifications: async () => {
    set((state) => ({ notifications: { ...state.notifications, status: 'loading' } }));
    try {
      const data = await fetchNotifications();
      // `null` is a failure the service could not throw on — Supabase reports
      // an error rather than rejecting, and a row the schema turns down is not
      // an exception either. It used to come back as `[]`, indistinguishable
      // from a student who simply has nothing on, and that took the same path
      // as a good answer: `success`, an empty feed, and `[]` written over the
      // cache. One blocked request and Novinky were empty, on this launch and
      // the next. Treated as the error it is, the cache survives it.
      //
      // A genuinely empty `[]` still goes through and still overwrites: a feed
      // that has run out has to be allowed to say so.
      if (data === null) {
        set((state) => ({ notifications: { ...state.notifications, status: 'error' } }));
        return;
      }
      set((state) => ({
        notifications: {
          ...state.notifications,
          data,
          status: 'success',
        },
      }));
      await IndexedDBService.set('meta', 'notifications_cache', data);
    } catch {
      set((state) => ({ notifications: { ...state.notifications, status: 'error' } }));
    }
  },

  markNotificationsRead: async (ids) => {
    const { readIds } = get().notifications;
    const next = new Set(readIds);
    ids.forEach((id) => next.add(id));

    set((state) => ({
      notifications: {
        ...state.notifications,
        readIds: next,
      },
    }));
    await IndexedDBService.set('meta', 'read_notifications', Array.from(next));
  },

  markNotificationViewed: async (id) => {
    const { viewedIds } = get().notifications;
    if (viewedIds.has(id)) return;

    const next = new Set(viewedIds);
    next.add(id);

    set((state) => ({
      notifications: {
        ...state.notifications,
        viewedIds: next,
      },
    }));

    // A society row is an event: Seen, the same number the map list gives.
    // reIS's own rows (admin, academic deadlines) are not events.
    const row = get().notifications.data.find((n) => n.id === id);
    const society = row?.associationId;
    if (society && society !== 'admin' && !society.startsWith('academic_')) {
      await trackEventSignal(id, 'seen');
    }
  },

  markDeadlineAlertsSeen: async (ids) => {
    const { seenDeadlineAlertIds } = get().notifications;
    const next = new Set(seenDeadlineAlertIds);
    ids.forEach((id) => next.add(id));

    set((state) => ({
      notifications: {
        ...state.notifications,
        seenDeadlineAlertIds: next,
      },
    }));
    await IndexedDBService.set('meta', 'seen_deadline_alerts', Array.from(next));
  },
});
