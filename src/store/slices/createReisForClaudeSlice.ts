import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

/** The `meta` key holding how far this device got with the row. */
export const REIS_FOR_CLAUDE_KEY = 'reis_for_claude_row';

/**
 * The "reIS v Claude" row in the extension's Novinky (Notifications/ReisForClaudeRow).
 *
 * - `loading`: boot has not read the device yet, so nothing shows.
 * - `new`: shown and counted on the bell.
 * - `seen`: Novinky was opened with it in; still shown, no longer on the badge.
 * - `done`: opened or dismissed; never shown again.
 *
 * Kept in IndexedDB, so a restart does not bring the badge or the row back.
 */
export type ReisForClaudeState = 'loading' | 'new' | 'seen' | 'done';

export interface ReisForClaudeSlice {
  reisForClaude: ReisForClaudeState;
  loadReisForClaude: () => Promise<void>;
  markReisForClaudeSeen: () => void;
  finishReisForClaude: () => void;
}

export const createReisForClaudeSlice: AppSlice<ReisForClaudeSlice> = (set, get) => {
  const persist = (state: 'seen' | 'done') => {
    set({ reisForClaude: state });
    // Only forward: another extension tab may have saved `done` since this one
    // loaded, and its stale `seen` must not bring the row back after a restart.
    const write = async () => {
      if (state === 'seen' && (await IndexedDBService.get('meta', REIS_FOR_CLAUDE_KEY)) === 'done')
        return;
      await IndexedDBService.set('meta', REIS_FOR_CLAUDE_KEY, state);
    };
    write().catch((err) => logError('ReisForClaudeSlice.persist', err));
  };
  return {
    reisForClaude: 'loading',
    loadReisForClaude: async () => {
      try {
        const saved = await IndexedDBService.get('meta', REIS_FOR_CLAUDE_KEY);
        // A mark made while the read was in flight wins.
        if (get().reisForClaude !== 'loading') return;
        set({ reisForClaude: saved === 'seen' || saved === 'done' ? saved : 'new' });
      } catch (err) {
        // Unread is safer than a row that keeps coming back: show nothing.
        logError('ReisForClaudeSlice.load', err);
      }
    },
    markReisForClaudeSeen: () => {
      if (get().reisForClaude === 'new') persist('seen');
    },
    finishReisForClaude: () => {
      if (get().reisForClaude !== 'done') persist('done');
    },
  };
};
