import type { I18nSlice, AppSlice, Language } from '../types';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { noteLanguagePick } from './impersonation/applyImpersonation';

const STORAGE_KEY = 'reis_language';
const DEFAULT_LANGUAGE: Language = 'cz';

export const createI18nSlice: AppSlice<I18nSlice> = (set, get) => {
  const show = (language: Language) => {
    setCurrentLanguage(language);
    set({ language, isLanguageLoading: false });
  };
  return {
    language: DEFAULT_LANGUAGE,
    isLanguageLoading: true,
    personaLanguage: null,
    // The persona's language while one sets it (Erasmus), else the saved one.
    // Every reload goes through here (boot, another tab, LANGUAGE_UPDATE), so
    // none of them can take the persona's English away mid-persona.
    loadLanguage: async () => {
      const persona = get().personaLanguage;
      if (persona) return show(persona);
      let language: Language = DEFAULT_LANGUAGE;
      try {
        const storedLang = (await IndexedDBService.get('meta', STORAGE_KEY)) as
          Language | undefined;
        if (storedLang === 'cz' || storedLang === 'en') language = storedLang;
      } catch {
        // Unreadable storage falls back to the default.
      }
      // A persona applied while this read IndexedDB (the boot restore) wins.
      show(get().personaLanguage ?? language);
    },
    setLanguage: async (newLang: Language) => {
      try {
        await IndexedDBService.set('meta', STORAGE_KEY, newLang);
        // The admin's own pick, even mid-persona: theirs from now on, also
        // over a persona still being fetched (applyImpersonation).
        noteLanguagePick();
        set({ personaLanguage: null });
        show(newLang);

        // Trigger global refresh for other components/tabs
        syncService.triggerRefresh('LANGUAGE_UPDATE');

        // Cross-context sync (optional but good for consistency across tabs)
        const bc = new BroadcastChannel('reis_language_sync');
        bc.postMessage(newLang);
        bc.close();
      } catch {
        // Language persistence failed
      }
    },
    // Design 2026-11-27 §2 "Language": in memory only. Nothing is saved and no
    // other tab is told, so whatever ends the persona (Já, another persona, an
    // admin or IS logout, a restart) finds the admin's own language on disk.
    // The menu, files and map events follow, as on a real switch.
    setPersonaLanguage: async (language) => {
      if (get().personaLanguage === language) return;
      const before = get().language;
      set({ personaLanguage: language });
      await get().loadLanguage();
      if (get().language !== before) syncService.triggerRefresh('LANGUAGE_UPDATE');
    },
  };
};
