import type { BulletinSlice, AppSlice } from '../types';
import type { BulletinPost } from '../../types/bulletin';
import { IndexedDBService } from '../../services/storage';

export const createBulletinSlice: AppSlice<BulletinSlice> = (set) => ({
    bulletinPosts: [],
    bulletinDismissed: false,

    fetchBulletin: async () => {
        try {
            const data = await IndexedDBService.get('meta', 'bulletin_posts');
            if (Array.isArray(data) && data.length > 0) {
                set({ bulletinPosts: data as BulletinPost[] });
            }
            const dismissed = await IndexedDBService.get('meta', 'bulletin_dismissed');
            if (dismissed === true) {
                set({ bulletinDismissed: true });
            }
        } catch {
            // IDB read failure is non-critical
        }
    },

    setBulletin: (posts: BulletinPost[]) => {
        set({ bulletinPosts: posts, bulletinDismissed: false });
        // Clear the persisted dismissed flag so new posts always re-surface
        IndexedDBService.set('meta', 'bulletin_dismissed', false).catch(() => {});
    },

    dismissBulletin: async () => {
        set({ bulletinDismissed: true });
        await IndexedDBService.set('meta', 'bulletin_dismissed', true);
    },
});
