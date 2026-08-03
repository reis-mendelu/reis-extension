import type { AppSlice } from '../types';
import {
  listSuggestions,
  setSuggestionStatus as apiSetStatus,
} from '../../api/suggestionsAdmin';
import type { SuggestionRow, SuggestionStatus } from '../../types/suggestions';

export interface SuggestionsSlice {
  suggestions: SuggestionRow[];
  suggestionsUnread: number;
  loadSuggestions: () => Promise<void>;
  updateSuggestionStatus: (id: number, status: SuggestionStatus) => Promise<void>;
}

const unread = (rows: SuggestionRow[]): number =>
  rows.filter((r) => r.status === 'new').length;

// Student suggestions, visible only to a reis_admin session. Loaded from the
// admin slice once the role resolves at boot — never from a component effect.
export const createSuggestionsSlice: AppSlice<SuggestionsSlice> = (set, get) => ({
  suggestions: [],
  suggestionsUnread: 0,

  loadSuggestions: async () => {
    const rows = await listSuggestions();
    set({ suggestions: rows, suggestionsUnread: unread(rows) });
  },

  updateSuggestionStatus: async (id, status) => {
    const target = get().suggestions.find((r) => r.id === id);
    if (!target) return;
    const previousStatus = target.status;

    // Optimistic: triaging should feel instant. Reverted below if the write is
    // rejected, so the badge can never claim an item was handled when it wasn't.
    // Only this one row's previous status is remembered (not a snapshot of the
    // whole list) so a revert can never clobber a concurrent update to another
    // row, or discard a loadSuggestions() that lands in between.
    const after = get().suggestions.map((r) => (r.id === id ? { ...r, status } : r));
    set({ suggestions: after, suggestionsUnread: unread(after) });

    const ok = await apiSetStatus(id, status);
    if (!ok) {
      // Re-apply against current state at revert time. If the row is gone
      // (e.g. a reload removed it), the map is a no-op — never resurrect it.
      const current = get().suggestions;
      const reverted = current.map((r) =>
        r.id === id ? { ...r, status: previousStatus } : r
      );
      set({ suggestions: reverted, suggestionsUnread: unread(reverted) });
    }
  },
});
