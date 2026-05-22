import type { BulletinSlice, AppSlice } from '../types';
import type { BulletinPost } from '../../types/bulletin';
import { IndexedDBService } from '../../services/storage';
import { fetchBulletin } from '../../api/bulletin';
import { logError } from '../../utils/reportError';

const TTL_MS = 30 * 60 * 1000;

export const createBulletinSlice: AppSlice<BulletinSlice> = (set, get) => ({
    bulletinPosts: [],
    bulletinFetchedAt: null,
    bulletinExpanded: false,
    bulletinLoading: false,
    bulletinError: false,

    hydrateBulletin: async () => {
        try {
            const posts = await IndexedDBService.get('meta', 'bulletin_posts');
            const fetchedAt = await IndexedDBService.get('meta', 'bulletin_fetched_at');
            const expanded = await IndexedDBService.get('meta', 'bulletin_expanded');
            set({
                bulletinPosts: Array.isArray(posts) ? (posts as BulletinPost[]) : [],
                bulletinFetchedAt: typeof fetchedAt === 'number' ? fetchedAt : null,
                bulletinExpanded: expanded === true,
            });
        } catch {
            // IDB read failure is non-critical
        }
    },

    setBulletinExpanded: async (expanded: boolean) => {
        set({ bulletinExpanded: expanded });
        await IndexedDBService.set('meta', 'bulletin_expanded', expanded);
    },

    loadBulletinIfStale: async () => {
        const { bulletinFetchedAt, bulletinLoading } = get();
        if (bulletinLoading) return;
        if (bulletinFetchedAt && Date.now() - bulletinFetchedAt < TTL_MS) return;

        set({ bulletinLoading: true, bulletinError: false });
        try {
            const posts = await fetchBulletin();
            const fetchedAt = Date.now();
            set({ bulletinPosts: posts, bulletinFetchedAt: fetchedAt, bulletinLoading: false });
            await IndexedDBService.set('meta', 'bulletin_posts', posts);
            await IndexedDBService.set('meta', 'bulletin_fetched_at', fetchedAt);
        } catch (e) {
            set({ bulletinLoading: false, bulletinError: true });
            logError('BulletinSlice.loadBulletinIfStale', e);
        }
    },
});
