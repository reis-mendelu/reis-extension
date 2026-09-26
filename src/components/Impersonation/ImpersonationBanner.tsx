import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { logError } from '../../utils/reportError';

/**
 * Not dismissible, on both trees: an admin must never mistake another
 * programme's timetable for their own. `row` sits above the phone's screens and
 * carries --safe-top itself (like DemoBanner); `floating` overlays the desktop.
 */
export function ImpersonationBanner({ variant }: { variant: 'row' | 'floating' }) {
  const { t } = useTranslation();
  const active = useAppStore((s) => s.impersonation);
  const stop = useAppStore((s) => s.stopImpersonation);
  const [pending, setPending] = useState(false);
  if (!active) return null;
  const { selection } = active;

  // Same double-tap guard as DemoBanner: exit re-reads nine stores.
  const exit = async () => {
    if (pending) return;
    setPending(true);
    try {
      await stop();
    } catch (e) {
      logError('ImpersonationBanner.exit', e);
    } finally {
      setPending(false);
    }
  };

  const cls =
    variant === 'row'
      ? 'flex flex-shrink-0 items-center justify-center gap-3 bg-info/20 px-4 pb-1 pt-[calc(0.25rem_+_var(--safe-top,0px))] text-xs text-base-content'
      : 'fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-info/40 bg-base-100 px-4 py-1 text-xs text-base-content shadow';

  return (
    <div className={cls} role="status">
      <UserCog size={14} className="flex-shrink-0 text-info" />
      <span className="font-semibold">
        {t('impersonation.bannerLabel', { programme: selection.shortCode, year: selection.year })}
        {selection.group !== null && ` · ${t('impersonation.groupN', { n: selection.group })}`}
      </span>
      <button className="btn btn-ghost btn-xs" onClick={() => void exit()} disabled={pending}>
        {pending ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          t('impersonation.bannerExit')
        )}
      </button>
    </div>
  );
}
