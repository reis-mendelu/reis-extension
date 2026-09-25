import type { AppSlice } from '../types';
import {
  listSuggestions,
  setSuggestionStatus as apiSetStatus,
  getSuggestionAttachments,
} from '../../api/suggestionsAdmin';
import type {
  SuggestionAttachment,
  SuggestionRow,
  SuggestionStatus,
} from '../../types/suggestions';

export interface SuggestionsSlice {
  suggestions: SuggestionRow[];
  suggestionsUnread: number;
  /** Ids with a status write in flight. Both row actions are enabled at once,
   *  so without this a fast triaged→done pair can complete out of order and
   *  leave the store disagreeing with the database. */
  suggestionsPending: number[];
  /** Opened attachments by report id. Loaded on demand, never with the list. */
  suggestionAttachments: Record<number, SuggestionAttachment | 'loading' | 'error'>;
  loadSuggestions: () => Promise<void>;
  loadSuggestionAttachments: (id: number) => Promise<void>;
  updateSuggestionStatus: (id: number, status: SuggestionStatus) => Promise<void>;
}

const unread = (rows: SuggestionRow[]): number => rows.filter((r) => r.status === 'new').length;

// Student suggestions, visible only to a reis_admin session. Loaded from the
// admin slice once the role resolves at boot — never from a component effect.
export const createSuggestionsSlice: AppSlice<SuggestionsSlice> = (set, get) => ({
  suggestions: [],
  suggestionsUnread: 0,
  suggestionsPending: [],
  suggestionAttachments: {},

  loadSuggestions: async () => {
    const rows = await listSuggestions();
    // `null` means the read failed (already logged in listSuggestions) —
    // leave existing state untouched rather than presenting a failed read
    // as an authoritative "inbox is empty". A genuine `[]` still clears it.
    if (rows === null) return;
    set({ suggestions: rows, suggestionsUnread: unread(rows) });
  },

  loadSuggestionAttachments: async (id) => {
    const current = get().suggestionAttachments[id];
    if (current && current !== 'error') return;
    set({ suggestionAttachments: { ...get().suggestionAttachments, [id]: 'loading' } });
    const a = await getSuggestionAttachments(id);
    set({ suggestionAttachments: { ...get().suggestionAttachments, [id]: a ?? 'error' } });
  },

  updateSuggestionStatus: async (id, status) => {
    const target = get().suggestions.find((r) => r.id === id);
    if (!target) return;
    // One write per row at a time. Both actions are enabled for a `new` row, so
    // a fast triaged→done pair would otherwise race: whichever response lands
    // last wins, and a failure on the first would resync away the second.
    if (get().suggestionsPending.includes(id)) return;

    // Optimistic: triaging should feel instant. `done` also clears the
    // attachments locally, because the server's trigger deletes them.
    const after = get().suggestions.map((r) =>
      r.id === id ? { ...r, status, ...(status === 'done' ? { attachments: null } : {}) } : r
    );
    set({
      suggestions: after,
      suggestionsUnread: unread(after),
      suggestionsPending: [...get().suggestionsPending, id],
    });

    let ok = false;
    try {
      ok = await apiSetStatus(id, status);
    } finally {
      set({ suggestionsPending: get().suggestionsPending.filter((p) => p !== id) });
    }
    if (ok && status === 'done') {
      const { [id]: _dropped, ...rest } = get().suggestionAttachments;
      void _dropped;
      set({ suggestionAttachments: rest });
    }
    if (!ok) {
      // Do not try to reconstruct the previous state locally — with two
      // interleaved writes on the same row, or a reload landing mid-flight,
      // any client-remembered "previous" value can be stale or was never
      // confirmed by the server in the first place (see reviewer-reported
      // failure modes). The database is the source of truth and a failed
      // write is a rare path, so just discard the local guess and resync
      // via the slice's own loadSuggestions() — one extra round trip is
      // cheap and always leaves the UI showing authoritative server state.
      //
      // Same-row races are now prevented by suggestionsPending above.
      // loadSuggestions() itself never turns a failed read into a blanked
      // inbox (see its `null` handling), which is the failure mode that
      // actually mattered here.
      await get().loadSuggestions();
    }
  },
});
