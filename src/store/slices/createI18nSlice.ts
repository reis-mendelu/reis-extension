import type { I18nSlice, AppSlice, Language } from '../types';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import { setCurrentLanguage } from '../../i18n/currentLanguage';
import { writeSyncLanguage } from '../../services/sync/syncLanguage';
import { refetchForSwitch } from '../../services/sync/languageRefetch';

const STORAGE_KEY = 'reis_language';
const DEFAULT_LANGUAGE: Language = 'cz';

export const createI18nSlice: AppSlice<I18nSlice> = (set) => ({
  language: DEFAULT_LANGUAGE,
  isLanguageLoading: true,
  loadLanguage: async () => {
    try {
      const storedLang = (await IndexedDBService.get('meta', STORAGE_KEY)) as Language | undefined;

      if (storedLang === 'cz' || storedLang === 'en') {
        // Mirrored for the sync, which fetches IS in this language and in the
        // extension cannot read this IndexedDB (see syncLanguage.ts). Awaited
        // before loading ends, so a stale-language check never runs ahead of it.
        await writeSyncLanguage(storedLang);
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

      // The app's own labels switched above; IS names follow once the sync has
      // refetched in the new language. Written first: the sync reads it at the
      // start of the run, so asking first would refetch the language just left.
      await writeSyncLanguage(newLang);
      refetchForSwitch(newLang, () => syncService.triggerSync());

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
