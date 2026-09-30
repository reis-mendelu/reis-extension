import type { I18nSlice, AppSlice, Language } from '../types';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import { setCurrentLanguage } from '../../i18n/currentLanguage';

const STORAGE_KEY = 'reis_language';
const DEFAULT_LANGUAGE: Language = 'cz';

// Notifications are built in the app's language, and a pending digest keeps
// its id and time across a switch — so every place the language settles
// replans, or the device keeps the old wording. `loadLanguage` covers the
// other-tab and LANGUAGE_UPDATE paths as well as boot, where the replan gate
// (follows/events/RSVP not loaded yet) makes the call a no-op.
export const createI18nSlice: AppSlice<I18nSlice> = (set, get) => ({
  language: DEFAULT_LANGUAGE,
  isLanguageLoading: true,
  loadLanguage: async () => {
    let language: Language = DEFAULT_LANGUAGE;
    try {
      const storedLang = (await IndexedDBService.get('meta', STORAGE_KEY)) as Language | undefined;
      if (storedLang === 'cz' || storedLang === 'en') language = storedLang;
    } catch {
      // Unreadable storage falls back to the default.
    }
    setCurrentLanguage(language);
    set({ language, isLanguageLoading: false });
    get().replanNotifications();
  },
  setLanguage: async (newLang: Language) => {
    try {
      await IndexedDBService.set('meta', STORAGE_KEY, newLang);
      setCurrentLanguage(newLang);
      set({ language: newLang });
      // Before the broadcast below, which can throw into the catch.
      get().replanNotifications();

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
});
