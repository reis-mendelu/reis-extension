import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { searchGlobal } from '../../api/search';
import type { SearchResult } from '../../components/SearchBar/types';

const MAX_RECENT_SEARCHES = 3;

export interface SearchSlice {
    recentSearches: SearchResult[];
    loadRecentSearches: () => Promise<void>;
    saveRecentSearch: (result: SearchResult, label: string) => Promise<void>;
    executeSearch: (query: string) => ReturnType<typeof searchGlobal>;
}

export const createSearchSlice: AppSlice<SearchSlice> = (set, get) => ({
    recentSearches: [],

    loadRecentSearches: async () => {
        try {
            const stored = await IndexedDBService.get('meta', 'recent_searches');
            if (stored) set({ recentSearches: stored as SearchResult[] });
        } catch { /* non-critical */ }
    },

    saveRecentSearch: async (result, label) => {
        const newItem = { ...result, detail: label };
        const current = get().recentSearches;
        const updated = [newItem, ...current.filter(r => r.title !== result.title)].slice(0, MAX_RECENT_SEARCHES);
        set({ recentSearches: updated });
        try {
            await IndexedDBService.set('meta', 'recent_searches', updated);
        } catch { /* non-critical */ }
    },

    executeSearch: (query) => searchGlobal(query),
});
