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

/**
 * Subjects are remembered the same way, and for the same reason.
 *
 * Lidé kept its own history and Předměty kept none, so the subject side of the
 * search sheet was blank until something was typed — on the half of it where a
 * student returns to the SAME few subjects all term. The mixed
 * `recentSearches` was no substitute: three entries deep, and a person or an
 * IS page evicts a subject from it immediately.
 */
const MAX_RECENT_SUBJECTS = 8;

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
  /** Recently opened SUBJECTS only — see MAX_RECENT_SUBJECTS. */
  recentSubjects: SearchResult[];
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
  recentSubjects: [],

  loadRecentSearches: async () => {
    try {
      const [stored, storedPeople, storedSubjects] = await Promise.all([
        IndexedDBService.get('meta', 'recent_searches'),
        IndexedDBService.get('meta', 'recent_people'),
        IndexedDBService.get('meta', 'recent_subjects'),
      ]);
      // Only hydrate a list nothing has written yet. This runs at boot and
      // resolves whenever IndexedDB gets round to it; a search saved in the
      // meantime is NEWER than the stored copy, and overwriting it here would
      // then be persisted by the next save — losing the person entirely.
      // Array.isArray, not a truthiness check and a cast. The `meta` store
      // accepts any record, so a malformed or half-migrated value reaches here
      // as an object — and `SearchSheet` then calls `.slice()` on it and throws
      // on a screen the student only wanted to search from.
      if (Array.isArray(stored) && get().recentSearches.length === 0) {
        set({ recentSearches: stored as SearchResult[] });
      }
      if (Array.isArray(storedPeople) && get().recentPeople.length === 0) {
        set({ recentPeople: storedPeople as SearchResult[] });
      }
      if (Array.isArray(storedSubjects) && get().recentSubjects.length === 0) {
        set({ recentSubjects: storedSubjects as SearchResult[] });
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
    // `result` here too, for the mirror-image reason: under "Naposledy
    // otevřené" the label would repeat the heading, where `detail` carries the
    // subject's own code and faculty — which is what tells two similarly named
    // courses apart.
    const isSubject = result.type === 'subject';
    const updatedSubjects = isSubject
      ? pushRecent(get().recentSubjects, result, MAX_RECENT_SUBJECTS)
      : get().recentSubjects;

    set({
      recentSearches: updated,
      ...(isPerson ? { recentPeople: updatedPeople } : {}),
      ...(isSubject ? { recentSubjects: updatedSubjects } : {}),
    });
    try {
      await IndexedDBService.set('meta', 'recent_searches', updated);
      if (isPerson) await IndexedDBService.set('meta', 'recent_people', updatedPeople);
      if (isSubject) await IndexedDBService.set('meta', 'recent_subjects', updatedSubjects);
    } catch {
      /* non-critical */
    }
  },

  executeSearch: (query, lang = 'cz', subjekt) => searchGlobal(query, lang, subjekt),
});
