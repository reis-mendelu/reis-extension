import cs from './locales/cs.json';
import en from './locales/en.json';

const locales: Record<string, Record<string, unknown>> = {
  cz: cs as Record<string, unknown>,
  cs: cs as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

/**
 * The translation lookup itself, with no React attached.
 *
 * Extracted from useTranslation because code that runs outside a component
 * still has to speak to the student: a document-level link interceptor, a
 * session-expiry prompt raised from a sync catch block. Those had no `t`, and
 * the alternatives were an untranslated string or a second copy of this logic.
 *
 * Behaviour is unchanged from the hook: an unknown key returns the key itself,
 * an unknown language falls back to Czech.
 */
export function translate(
  language: string,
  key: string,
  params?: Record<string, string | number>
): string {
  const currentLocale = locales[language] || locales.cz;
  let result: unknown = currentLocale;

  for (const k of key.split('.')) {
    if (
      result &&
      typeof result === 'object' &&
      (result as Record<string, unknown>)[k] !== undefined
    ) {
      result = (result as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  if (typeof result !== 'string') return key;
  if (!params) return result;
  return result.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}
