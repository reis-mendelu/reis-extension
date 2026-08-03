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

    // Optimistic: triaging should feel instant.
    const after = get().suggestions.map((r) => (r.id === id ? { ...r, status } : r));
    set({ suggestions: after, suggestionsUnread: unread(after) });

    const ok = await apiSetStatus(id, status);
    if (!ok) {
      // Do not try to reconstruct the previous state locally — with two
      // interleaved writes on the same row, or a reload landing mid-flight,
      // any client-remembered "previous" value can be stale or was never
      // confirmed by the server in the first place (see reviewer-reported
      // failure modes). The database is the source of truth and a failed
      // write is a rare path, so just discard the local guess and resync
      // via the slice's own loadSuggestions() — one extra round trip is
      // cheap and always leaves the UI showing authoritative server state.
      await get().loadSuggestions();
    }
  },
});
