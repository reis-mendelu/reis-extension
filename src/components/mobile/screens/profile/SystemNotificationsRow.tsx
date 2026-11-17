import { Bell, Users } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { enableNotifications } from '../../../../mobile/notificationPermission';

/**
 * Nastavení: whether the phone lets reIS notify at all. Nothing until the
 * system has answered (`unknown`), so it never claims a state it has not read.
 * Off offers the one button that fixes it: the system dialog while Android
 * will still show it, otherwise the app's page in Settings.
 */
export function SystemNotificationsRow() {
  const { t } = useTranslation();
  const status = useAppStore((s) => s.systemNotifications);
  const societies = useAppStore((s) => s.notifySocieties);
  const setSocieties = useAppStore((s) => s.setNotifySocieties);
  if (status === 'unknown') return null;
  const on = status === 'granted';
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Bell size={16} className="flex-shrink-0 text-base-content/50" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-md font-medium">{t('notifications.systemLabel')}</span>
          <span className={`text-xs ${on ? 'text-base-content/60' : 'text-[var(--tone-error)]'}`}>
            {on ? t('notifications.systemOn') : t('notifications.systemOff')}
          </span>
        </div>
        {!on && (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="btn btn-primary btn-xs"
          >
            {t('notifications.systemEnable')}
          </button>
        )}
      </div>
      {/* Society events and MENDELU notices as phone notifications too (agreed
        2026-11-17: on by default, one switch). Only while notifications are on:
        off, the switch would change nothing. */}
      {on && (
        <label className="flex items-center gap-3 px-4 py-2.5">
          <Users size={16} className="flex-shrink-0 text-base-content/50" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-md font-medium">{t('novinkyPush.societiesSwitch')}</span>
            <span className="text-xs text-base-content/60">
              {t('novinkyPush.societiesSwitchHint')}
            </span>
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={societies}
            onChange={(e) => setSocieties(e.target.checked)}
          />
        </label>
      )}
    </>
  );
}
