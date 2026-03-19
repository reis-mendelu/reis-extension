import { useAppStore } from '../store/useAppStore';
import cs from '../i18n/locales/cs.json';
import en from '../i18n/locales/en.json';

const locales: Record<string, Record<string, unknown>> = {
  cz: cs as Record<string, unknown>,
  cs: cs as Record<string, unknown>,
  en: en as Record<string, unknown>
};

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  const currentLocale = locales[language] || locales.cz;

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let result: unknown = currentLocale;

    for (const k of keys) {
      if (result && typeof result === 'object' && (result as Record<string, unknown>)[k] !== undefined) {
        result = (result as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    if (typeof result !== 'string') return key;
    if (!params) return result;
    return result.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  };

  return { t, language };
}
