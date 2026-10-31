import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { setBackgroundCheckEnabled } from '../../../../mobile/backgroundCheckNative';
import { logError } from '../../../../utils/reportError';

/**
 * Nastavení: the Android background check. Nothing until the phone has said
 * the check exists (`unknown`: iPhone, the extension). On by default, and this
 * is its one switch; the hint says what it does and that it uses the student's
 * IS sign-in, because that is the part worth knowing before leaving it on.
 */
export function BackgroundCheckRow() {
  const { t } = useTranslation();
  const state = useAppStore((s) => s.backgroundCheck);
  const set = useAppStore((s) => s.setBackgroundCheck);
  if (state === 'unknown') return null;
  const on = state === 'on';
  const label = t('backgroundCheck.label');

  const toggle = async () => {
    try {
      await setBackgroundCheckEnabled(!on);
      set(on ? 'off' : 'on');
    } catch (err) {
      logError('BackgroundCheckRow.toggle', err);
    }
  };

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <RefreshCw size={16} className="mt-0.5 flex-shrink-0 text-base-content/50" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-md font-medium">{label}</span>
        <span className="text-xs text-base-content/60">{t('backgroundCheck.hint')}</span>
      </div>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        className="toggle toggle-primary toggle-sm mt-0.5"
        checked={on}
        onChange={() => void toggle()}
      />
    </div>
  );
}
