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
    const before = get().suggestions;
    // Optimistic: triaging should feel instant. Reverted below if the write is
    // rejected, so the badge can never claim an item was handled when it wasn't.
    const after = before.map((r) => (r.id === id ? { ...r, status } : r));
    set({ suggestions: after, suggestionsUnread: unread(after) });

    const ok = await apiSetStatus(id, status);
    if (!ok) set({ suggestions: before, suggestionsUnread: unread(before) });
  },
});
