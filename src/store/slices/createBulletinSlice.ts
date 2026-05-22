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
            const hydratedPosts = Array.isArray(posts) ? (posts as BulletinPost[]) : [];
            // Don't trust a cached "fresh" timestamp when we have no posts —
            // an empty result is never worth caching; force a retry on next expand.
            const hydratedFetchedAt = hydratedPosts.length > 0 && typeof fetchedAt === 'number' ? fetchedAt : null;
            set({
                bulletinPosts: hydratedPosts,
                bulletinFetchedAt: hydratedFetchedAt,
                bulletinExpanded: expanded === true,
            });
        } catch {
            // IDB read failure is non-critical
        }
    },

    setBulletinExpanded: async (expanded: boolean) => {
        set({ bulletinExpanded: expanded });
        // IndexedDBService.set silently drops falsy values (guard `if (!validated) return`),
        // so persist `true` by writing and `false` by deleting. Hydrate treats a missing
        // key as collapsed, which matches the in-memory default.
        if (expanded) {
            await IndexedDBService.set('meta', 'bulletin_expanded', true);
        } else {
            await IndexedDBService.delete('meta', 'bulletin_expanded');
        }
    },

    loadBulletinIfStale: async () => {
        const { bulletinFetchedAt, bulletinLoading } = get();
        if (bulletinLoading) return;
        if (bulletinFetchedAt && Date.now() - bulletinFetchedAt < TTL_MS) return;

        set({ bulletinLoading: true, bulletinError: false });
        try {
            const posts = await fetchBulletin();
            const fetchedAt = posts.length > 0 ? Date.now() : null;
            set({ bulletinPosts: posts, bulletinFetchedAt: fetchedAt, bulletinLoading: false });
            await IndexedDBService.set('meta', 'bulletin_posts', posts);
            // Same falsy-drop reason as above: persist timestamp by writing, clear by deleting.
            if (fetchedAt !== null) {
                await IndexedDBService.set('meta', 'bulletin_fetched_at', fetchedAt);
            } else {
                await IndexedDBService.delete('meta', 'bulletin_fetched_at');
            }
        } catch (e) {
            set({ bulletinLoading: false, bulletinError: true });
            logError('BulletinSlice.loadBulletinIfStale', e);
        }
    },
});
