import type { StateCreator } from 'zustand';
import type { AppState, Language } from '../types';
import { fetchPersonProfile, type PersonProfile } from '../../api/personProfile';
import { logError } from '../../utils/reportError';

const TTL_MS = 24 * 60 * 60 * 1000;

export interface PersonProfileEntry {
  data: PersonProfile | null;
  fetchedAt: number;
  /**
   * Language the entry was fetched in. Without it a cached Czech profile is
   * served to a student who has since switched to English and the card stays
   * Czech for the whole 24h TTL — the cache would reintroduce #206 on its own.
   */
  lang: Language;
  error?: string;
}

export interface PersonProfileSlice {
  personProfiles: Record<number, PersonProfileEntry>;
  personProfilesLoading: Record<number, boolean>;
  fetchPersonProfileById: (personId: number) => Promise<void>;
}

export const createPersonProfileSlice: StateCreator<AppState, [], [], PersonProfileSlice> = (
  set,
  get
) => ({
  personProfiles: {},
  personProfilesLoading: {},

  fetchPersonProfileById: async (personId) => {
    const state = get();
    if (state.personProfilesLoading[personId]) return;

    const lang = state.language;
    const existing = state.personProfiles[personId];
    if (
      existing &&
      existing.lang === lang &&
      Date.now() - existing.fetchedAt < TTL_MS &&
      !existing.error
    ) {
      return;
    }

    set((s) => ({
      personProfilesLoading: { ...s.personProfilesLoading, [personId]: true },
    }));

    /**
     * The student can flip the language toggle while this request is in the
     * air. Writing the result then would put the card one language behind —
     * #206 again — and the loading guard above means no later call can fix it,
     * because the entry it would land in is the one still being written. So the
     * stale answer is dropped, the guard is released, and the fetch restarts in
     * whatever language is current now.
     */
    const restartedInNewLanguage = () => {
      if (get().language === lang) return false;
      set((s) => ({
        personProfilesLoading: { ...s.personProfilesLoading, [personId]: false },
      }));
      void get().fetchPersonProfileById(personId);
      return true;
    };

    try {
      const data = await fetchPersonProfile(personId, lang);
      if (restartedInNewLanguage()) return;
      set((s) => ({
        personProfiles: {
          ...s.personProfiles,
          [personId]: { data, fetchedAt: Date.now(), lang },
        },
        personProfilesLoading: { ...s.personProfilesLoading, [personId]: false },
      }));
    } catch (e) {
      // Reported before the language check: the request genuinely failed, and
      // that is worth telemetry whether or not its answer is still wanted.
      logError('PersonProfileSlice.fetchPersonProfileById', e, { personId });
      if (restartedInNewLanguage()) return;
      const msg = e instanceof Error ? e.message : String(e);
      set((s) => ({
        personProfiles: {
          ...s.personProfiles,
          [personId]: { data: null, fetchedAt: Date.now(), lang, error: msg },
        },
        personProfilesLoading: { ...s.personProfilesLoading, [personId]: false },
      }));
    }
  },
});
