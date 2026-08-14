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

    try {
      const data = await fetchPersonProfile(personId, lang);
      set((s) => ({
        personProfiles: {
          ...s.personProfiles,
          [personId]: { data, fetchedAt: Date.now(), lang },
        },
        personProfilesLoading: { ...s.personProfilesLoading, [personId]: false },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('PersonProfileSlice.fetchPersonProfileById', e, { personId });
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
