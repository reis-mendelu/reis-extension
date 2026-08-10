import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { searchGlobal } from '../../api/search';
import type { SearchResult } from '../../components/SearchBar/types';

/** What the search dropdowns show, unchanged: the three most recent of anything. */
const MAX_RECENT_SEARCHES = 3;

/**
 * People are remembered separately, and deeper.
 *
 * The phone's Lidé tab lists who you looked up recently, and it used to read the
 * one mixed history — where three IS-page searches evicted every person, so the
 * list was usually empty. A second list costs one more meta key and means
 * looking up pages can never push people out.
 */
const MAX_RECENT_PEOPLE = 8;

/** Two people in IS genuinely share a name; their ids do not. */
function isSameEntry(a: SearchResult, b: SearchResult): boolean {
  if (a.type !== b.type) return false;
  return a.id && b.id ? a.id === b.id : a.title === b.title;
}

function pushRecent(list: SearchResult[], item: SearchResult, max: number): SearchResult[] {
  return [item, ...list.filter((r) => !isSameEntry(r, item))].slice(0, max);
}

export interface SearchSlice {
  recentSearches: SearchResult[];
  /** Recently searched PEOPLE only — see MAX_RECENT_PEOPLE. */
  recentPeople: SearchResult[];
  loadRecentSearches: () => Promise<void>;
  saveRecentSearch: (result: SearchResult, label: string) => Promise<void>;
  executeSearch: (
    query: string,
    lang?: 'cz' | 'en',
    subjekt?: string
  ) => ReturnType<typeof searchGlobal>;
}

export const createSearchSlice: AppSlice<SearchSlice> = (set, get) => ({
  recentSearches: [],
  recentPeople: [],

  loadRecentSearches: async () => {
    try {
      const [stored, storedPeople] = await Promise.all([
        IndexedDBService.get('meta', 'recent_searches'),
        IndexedDBService.get('meta', 'recent_people'),
      ]);
      // Only hydrate a list nothing has written yet. This runs at boot and
      // resolves whenever IndexedDB gets round to it; a search saved in the
      // meantime is NEWER than the stored copy, and overwriting it here would
      // then be persisted by the next save — losing the person entirely.
      if (stored && get().recentSearches.length === 0) {
        set({ recentSearches: stored as SearchResult[] });
      }
      if (storedPeople && get().recentPeople.length === 0) {
        set({ recentPeople: storedPeople as SearchResult[] });
      }
    } catch {
      /* non-critical */
    }
  },

  saveRecentSearch: async (result, label) => {
    const newItem = { ...result, detail: label };
    const updated = pushRecent(get().recentSearches, newItem, MAX_RECENT_SEARCHES);
    const isPerson = result.type === 'person';
    // `result`, not `newItem`: the label overwrites `detail`, which for a person
    // is their role. In the dropdown "Nedávno hledáno" is the useful line; under
    // the phone's "Naposledy hledaní" heading it is the heading said twice,
    // where "Student" / "Vyučující" tells you which Novák this is.
    const updatedPeople = isPerson
      ? pushRecent(get().recentPeople, result, MAX_RECENT_PEOPLE)
      : get().recentPeople;

    set(
      isPerson
        ? { recentSearches: updated, recentPeople: updatedPeople }
        : { recentSearches: updated }
    );
    try {
      await IndexedDBService.set('meta', 'recent_searches', updated);
      if (isPerson) await IndexedDBService.set('meta', 'recent_people', updatedPeople);
    } catch {
      /* non-critical */
    }
  },

  executeSearch: (query, lang = 'cz', subjekt) => searchGlobal(query, lang, subjekt),
});
