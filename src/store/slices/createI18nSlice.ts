import type { I18nSlice, AppSlice, Language } from '../types';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import { setCurrentLanguage } from '../../i18n/currentLanguage';

const STORAGE_KEY = 'reis_language';
const DEFAULT_LANGUAGE: Language = 'cz';

export const createI18nSlice: AppSlice<I18nSlice> = (set) => ({
  language: DEFAULT_LANGUAGE,
  isLanguageLoading: true,
  loadLanguage: async () => {
    try {
      const storedLang = (await IndexedDBService.get('meta', STORAGE_KEY)) as Language | undefined;

      if (storedLang === 'cz' || storedLang === 'en') {
        setCurrentLanguage(storedLang);
        set({ language: storedLang, isLanguageLoading: false });
        return;
      }

      setCurrentLanguage(DEFAULT_LANGUAGE);
      set({ language: DEFAULT_LANGUAGE, isLanguageLoading: false });
    } catch {
      setCurrentLanguage(DEFAULT_LANGUAGE);
      set({ language: DEFAULT_LANGUAGE, isLanguageLoading: false });
    }
  },
  setLanguage: async (newLang: Language) => {
    try {
      await IndexedDBService.set('meta', STORAGE_KEY, newLang);
      setCurrentLanguage(newLang);
      set({ language: newLang });

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
