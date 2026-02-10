import type { I18nSlice, AppSlice, Language } from '../types';
import { IndexedDBService } from '../../services/storage';
import { syncService } from '../../services/sync';
import { getUserParams } from '../../utils/userParams';

const STORAGE_KEY = "reis_language";
const DEFAULT_LANGUAGE: Language = "cs";

export const createI18nSlice: AppSlice<I18nSlice> = (set) => ({
    language: DEFAULT_LANGUAGE,
    isLanguageLoading: true,
    loadLanguage: async () => {
        try {
            const storedLang = await IndexedDBService.get("meta", STORAGE_KEY) as Language | undefined;
            
            if (storedLang === "cs" || storedLang === "en") {
                set({ language: storedLang, isLanguageLoading: false });
                return;
            }

            // No preference stored, check for Erasmus status
            const userParams = await getUserParams();
            const language = userParams?.isErasmus ? "en" : DEFAULT_LANGUAGE;
            
            set({ language, isLanguageLoading: false });
        } catch (e) {
            console.error("[I18nSlice] Failed to load language:", e);
            set({ isLanguageLoading: false });
        }
    },
    setLanguage: async (newLang: Language) => {
        try {
            console.log('[I18nSlice] 🌍 Language change requested:', newLang);
            await IndexedDBService.set("meta", STORAGE_KEY, newLang);
            set({ language: newLang });
            console.log('[I18nSlice] 💾 Language saved to IndexedDB:', newLang);
            
            // Trigger global refresh for other components/tabs
            console.log('[I18nSlice] 🔔 Triggering refresh event: LANGUAGE_UPDATE');
            syncService.triggerRefresh('LANGUAGE_UPDATE');
            
            // Cross-context sync (optional but good for consistency across tabs)
            const bc = new BroadcastChannel('reis_language_sync');
            bc.postMessage(newLang);
            bc.close();
            console.log('[I18nSlice] ✅ Language change complete');
        } catch (e) {
            console.error("[I18nSlice] Failed to set language:", e);
        }
    },
});
