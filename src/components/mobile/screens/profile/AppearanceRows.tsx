import { Moon, Languages } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTheme } from '../../../../hooks/useTheme';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * Dark mode and language — the two rows under VZHLED.
 *
 * Extracted with `MapAppRow`, which is deliberately shaped like the language
 * row: same `join` of `btn-xs` buttons, same "label left, options right". They
 * sit next to each other in one folder so the next settings control has an
 * obvious pattern to copy rather than a screen to read.
 */
export function AppearanceRows() {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    <>
      {/* No caption under the label. A dark-mode switch does not need one, and
          "šetří oči i baterku" was a second line of type for a control whose
          entire meaning is its own name. */}
      <label className="flex items-center gap-3 px-4 py-2.5">
        <Moon size={16} className="flex-shrink-0 text-base-content/50" />
        <span className="min-w-0 flex-1 text-md font-medium">{t('settings.darkMode')}</span>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm"
          checked={isDark}
          onChange={toggleTheme}
        />
      </label>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Languages size={16} className="flex-shrink-0 text-base-content/50" />
        <span className="flex-1 text-md font-medium">{t('settings.language')}</span>
        <div className="join">
          <button
            type="button"
            onClick={() => setLanguage('cz')}
            className={`join-item btn btn-xs ${language === 'cz' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
          >
            {t('settings.czech')}
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`join-item btn btn-xs ${language === 'en' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
          >
            {t('settings.english')}
          </button>
        </div>
      </div>
    </>
  );
}
