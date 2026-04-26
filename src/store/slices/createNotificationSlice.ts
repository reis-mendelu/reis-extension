import type { AppSlice, NotificationSlice } from '../types';
import { fetchNotifications, trackNotificationsViewed } from '../../services/spolky';
import { IndexedDBService } from '../../services/storage';

export const createNotificationSlice: AppSlice<NotificationSlice> = (set, get) => ({
    notifications: {
        data: [],
        readIds: new Set(),
        viewedIds: new Set(),
        seenDeadlineAlertIds: new Set(),
        status: 'idle',
    },

    loadNotificationState: async () => {
        const [readIds, viewedIds, seenIds, cache] = await Promise.all([
            IndexedDBService.get('meta', 'read_notifications'),
            IndexedDBService.get('meta', 'viewed_notifications_analytics'),
            IndexedDBService.get('meta', 'seen_deadline_alerts'),
            IndexedDBService.get('meta', 'notifications_cache'),
        ]);

        set((state) => ({
            notifications: {
                ...state.notifications,
                readIds: new Set(readIds || []),
                viewedIds: new Set(viewedIds || []),
                seenDeadlineAlertIds: new Set(seenIds || []),
                data: cache || [],
            },
        }));
    },

    fetchNotifications: async () => {
        set((state) => ({ notifications: { ...state.notifications, status: 'loading' } }));
        try {
            const data = await fetchNotifications();
            set((state) => ({
                notifications: {
                    ...state.notifications,
                    data,
                    status: 'success',
                },
            }));
            await IndexedDBService.set('meta', 'notifications_cache', data);
        } catch (error) {
            set((state) => ({ notifications: { ...state.notifications, status: 'error' } }));
        }
    },

    markNotificationsRead: async (ids) => {
        const { readIds } = get().notifications;
        const next = new Set(readIds);
        ids.forEach(id => next.add(id));

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
        
        await trackNotificationsViewed([id]);
        await IndexedDBService.set('meta', 'viewed_notifications_analytics', Array.from(next));
    },

    markDeadlineAlertsSeen: async (ids) => {
        const { seenDeadlineAlertIds } = get().notifications;
        const next = new Set(seenDeadlineAlertIds);
        ids.forEach(id => next.add(id));

        set((state) => ({
            notifications: {
                ...state.notifications,
                seenDeadlineAlertIds: next,
            },
        }));
        await IndexedDBService.set('meta', 'seen_deadline_alerts', Array.from(next));
    },
});
