import { ArrowDownToLine, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { openAppUpdate } from '../../../mobile/appUpdate';

/**
 * "Nová verze reISu" at the top of the phone's Novinky (src/mobile/appUpdate
 * finds it; utils/appUpdateOffer decides when).
 *
 * Not a society row. That one is a title over the sender's name, and its title
 * has room for about sixteen characters at 320px, so "update reIS" could not
 * say why or how (Dominik, 2026-11-17, on the "Aktualizuj reIS" post). Here
 * the second line is the instruction and the right column the version, in the
 * same card, slot and type sizes as NotificationItem, so the rows line up.
 */
export function AppUpdateRow() {
  const { t } = useTranslation();
  const offer = useAppStore((s) => s.appUpdate);
  if (!offer) return null;
  return (
    <button
      type="button"
      onClick={() => void openAppUpdate()}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5 text-left transition-colors hover:bg-base-200"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ArrowDownToLine size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-md font-bold text-base-content">{t('appUpdate.title')}</span>
        <span className="truncate text-2sm text-base-content/60">{t('appUpdate.body')}</span>
      </span>
      {offer.version && (
        <span className="flex-shrink-0 whitespace-nowrap text-2sm font-bold text-base-content">
          {offer.version}
        </span>
      )}
      <ChevronRight size={16} className="flex-shrink-0 text-base-content/40" aria-hidden />
    </button>
  );
}
