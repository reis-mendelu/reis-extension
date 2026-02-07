import { useAppStore } from '../store/useAppStore';
import cs from '../i18n/locales/cs.json';
import en from '../i18n/locales/en.json';

const locales: Record<string, any> = { cs, en };

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  const currentLocale = locales[language] || locales.cs;

  const t = (key: string) => {
    const keys = key.split('.');
    let result = currentLocale;
    
    for (const k of keys) {
      if (result && result[k] !== undefined) {
        result = result[k];
      } else {
        console.warn(`[i18n] Translation key not found: ${key} (${language})`);
        return key;
      }
    }
    
    return result;
  };

  return { t, language };
}
