import type { I18nSlice, AppSlice, Language } from '../types';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';

const STORAGE_KEY = "reis_language";
const DEFAULT_LANGUAGE: Language = "cs";

export const createI18nSlice: AppSlice<I18nSlice> = (set) => ({
    language: DEFAULT_LANGUAGE,
    isLanguageLoading: true,
    loadLanguage: async () => {
        try {
            const storedLang = await IndexedDBService.get("meta", STORAGE_KEY) as Language | undefined;
            const language = (storedLang === "cs" || storedLang === "en") ? storedLang : DEFAULT_LANGUAGE;
            
            set({ language, isLanguageLoading: false });
        } catch (e) {
            console.error("[I18nSlice] Failed to load language:", e);
            set({ isLanguageLoading: false });
        }
    },
    setLanguage: async (newLang: Language) => {
        try {
            await IndexedDBService.set("meta", STORAGE_KEY, newLang);
            set({ language: newLang });
            
            // Trigger global refresh for other components/tabs
            syncService.triggerRefresh('LANGUAGE_UPDATE');
            
            // Cross-context sync (optional but good for consistency across tabs)
            const bc = new BroadcastChannel('reis_language_sync');
            bc.postMessage(newLang);
            bc.close();
        } catch (e) {
            console.error("[I18nSlice] Failed to set language:", e);
        }
    },
});
