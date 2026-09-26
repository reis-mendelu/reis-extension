import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import { ImpersonationPicker } from './ImpersonationPicker';

/** Desktop wrapper. The phone tree uses ImpersonationSheet around the same picker. */
export function ImpersonationDrawer() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.impersonationPickerOpen);
  const close = useAppStore((s) => s.closeImpersonationPicker);
  return (
    <AdaptiveDrawer
      open={open}
      onClose={close}
      width="sm:w-[420px]"
      title={t('impersonation.title')}
    >
      {/* AdaptiveDrawer's `title` is sr-only on desktop, so a visible header —
          mirrors DocumentsDrawer. */}
      <div className="flex items-center gap-3 border-b border-base-300 px-4 pb-3 pt-4">
        <h2 className="flex-1 text-base font-bold">{t('impersonation.title')}</h2>
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={close}
          aria-label={t('impersonation.close')}
        >
          <X size={16} />
        </button>
      </div>
      <ImpersonationPicker />
    </AdaptiveDrawer>
  );
}
