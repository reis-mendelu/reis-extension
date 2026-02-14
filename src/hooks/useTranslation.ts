import { useAppStore } from '../store/useAppStore';
import cs from '../i18n/locales/cs.json';
import en from '../i18n/locales/en.json';

const locales: Record<string, Record<string, unknown>> = { cz: cs as Record<string, unknown>, en: en as Record<string, unknown> };

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  const currentLocale = locales[language] || locales.cz;

  const t = (key: string): string => {
    const keys = key.split('.');
    let result: unknown = currentLocale;
    
    for (const k of keys) {
      if (result && typeof result === 'object' && (result as Record<string, unknown>)[k] !== undefined) {
        result = (result as Record<string, unknown>)[k];
      } else {
        console.debug(`[i18n] Translation key not found: ${key} (${language})`); // Debug logging
        return key;
      }
    }
    
    return typeof result === 'string' ? result : key;
  };

  return { t, language };
}
