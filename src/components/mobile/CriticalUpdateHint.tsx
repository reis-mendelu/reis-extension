import { ArrowDownToLine } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { openAppUpdate } from '../../mobile/appUpdate';

/**
 * Above "Něco chybí?" on an empty Předměty or Zkoušky, while this install is
 * below the critical version (utils/criticalUpdate). That empty list is where
 * the two students on 5.6.0 got stuck and reported "no subjects" instead of
 * updating (suggestions 46, 47). Unlike the pop-up it is not counted against
 * a limit: it shows only where something is actually missing.
 */
export function CriticalUpdateHint() {
  const { t, language } = useTranslation();
  const critical = useAppStore((s) => s.criticalUpdate);
  if (!critical) return null;
  return (
    <div data-testid="critical-update-hint" className="flex max-w-64 flex-col items-center gap-2">
      <p className="text-xs text-base-content/75">{critical.reason[language]}</p>
      <button
        type="button"
        className="btn btn-primary btn-sm min-h-11 h-auto gap-2"
        onClick={() => void openAppUpdate('critical_update_opened')}
      >
        <ArrowDownToLine size={16} aria-hidden />
        {t('appUpdate.critical.update')}
      </button>
    </div>
  );
}
