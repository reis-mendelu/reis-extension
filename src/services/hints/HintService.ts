import { IndexedDBService } from '../storage';

const HINT_STORE = 'meta';
const HINT_PREFIX = 'hint_seen_';

/**
 * HintService
 *
 * Manages the "seen" status of various UI hints and discovery points.
 * Persists status in IndexedDB under the 'meta' store.
 */
export const HintService = {
  /**
   * Checks if a hint has been seen by the user.
   */
  async isSeen(hintId: string): Promise<boolean> {
    try {
      const status = await IndexedDBService.get(HINT_STORE, HINT_PREFIX + hintId);
      return !!status;
    } catch {
      return false;
    }
  },

  /**
   * Marks a hint as seen and persists it.
   */
  async markSeen(hintId: string): Promise<void> {
    try {
      await IndexedDBService.set(HINT_STORE, HINT_PREFIX + hintId, true);
    } catch {
      // Best-effort persistence
    }
  },

  /**
   * Resets a hint status (useful for development/testing).
   */
  async reset(hintId: string): Promise<void> {
    try {
      await IndexedDBService.set(HINT_STORE, HINT_PREFIX + hintId, false);
    } catch {
      // Best-effort persistence
    }
  },
};
