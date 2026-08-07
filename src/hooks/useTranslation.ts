import { useAppStore } from '../store/useAppStore';
import { translate } from '../i18n/translate';

export function useTranslation() {
  const language = useAppStore((state) => state.language);

  const t = (key: string, params?: Record<string, string | number>): string =>
    translate(language, key, params);

  return { t, language };
}
