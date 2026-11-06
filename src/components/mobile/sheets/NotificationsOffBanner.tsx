import { BellOff } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { enableNotifications } from '../../../mobile/notificationPermission';

/**
 * Top of the bell's sheet while the phone has reIS notifications off. A student
 * lived with them off for weeks because nothing said so; this is where they
 * look for news, so this is where it says so.
 */
export function NotificationsOffBanner() {
  const { t } = useTranslation();
  const status = useAppStore((s) => s.systemNotifications);
  if (status !== 'denied' && status !== 'prompt') return null;
  return (
    <div
      role="status"
      className="mb-2 flex items-center gap-3 rounded-xl bg-base-200 px-3 py-2.5 text-base-content"
    >
      <BellOff size={16} className="flex-shrink-0 text-base-content/60" />
      <span className="min-w-0 flex-1 text-sm">{t('notifications.systemBanner')}</span>
      <button
        type="button"
        onClick={() => void enableNotifications()}
        className="btn btn-primary btn-xs flex-shrink-0"
      >
        {t('notifications.systemEnable')}
      </button>
    </div>
  );
}
