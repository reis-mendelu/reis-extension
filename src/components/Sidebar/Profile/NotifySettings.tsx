import { Bell, BellOff } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { askNotificationPermission } from '../../../services/eventReminders/sync';

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between px-2 py-1.5 rounded-md">
      <span className="text-xs opacity-90">{label}</span>
      <input
        type="checkbox"
        className="toggle toggle-sm"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/**
 * The Oznámení group at the top of Profile → Spolky, phone/iPad only (see
 * `notificationUiIsPhoneOnly` — the extension posts no notifications, so it
 * has nothing for these switches to control).
 *
 * One state per OS permission: still askable (`prompt` or
 * `prompt-with-rationale`) shows a single Turn-on button that asks, records
 * whatever the OS answered and replans; `granted` shows the three switches;
 * `denied` shows an explanatory line — a switch that could do nothing is
 * worse than no switch. Unread (`null`) or `unsupported` renders nothing.
 */
export function NotifySettings() {
  const { t } = useTranslation();
  const notifyPrefs = useAppStore((s) => s.notifyPrefs);
  const notifyPermission = useAppStore((s) => s.notifyPermission);
  const setNotifyPref = useAppStore((s) => s.setNotifyPref);
  const setNotifyPermission = useAppStore((s) => s.setNotifyPermission);
  const replanNotifications = useAppStore((s) => s.replanNotifications);

  if (notifyPermission === null || notifyPermission === 'unsupported') return null;

  const onTurnOn = async () => {
    const result = await askNotificationPermission();
    setNotifyPermission(result);
    replanNotifications();
  };

  return (
    <div className="mb-2 px-1">
      <div className="px-1 py-1 text-xs font-medium opacity-70">{t('notify.section')}</div>
      {notifyPermission === 'denied' ? (
        <p className="px-2 py-1.5 text-xs opacity-70">{t('notify.denied')}</p>
      ) : notifyPermission === 'granted' ? (
        <div className="space-y-1">
          <ToggleRow
            label={t('notify.myEvents')}
            checked={notifyPrefs.myEvents}
            onChange={(v) => void setNotifyPref('myEvents', v)}
          />
          <ToggleRow
            label={t('notify.followedEvents')}
            checked={notifyPrefs.followedEvents}
            onChange={(v) => void setNotifyPref('followedEvents', v)}
          />
          <ToggleRow
            label={t('notify.newEvents')}
            checked={notifyPrefs.newEvents}
            onChange={(v) => void setNotifyPref('newEvents', v)}
          />
        </div>
      ) : (
        <div className="px-2 py-1.5">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void onTurnOn()}>
            {t('notify.turnOn')}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Per-society mute bell, shown only on a followed row (see `SpolkySection`).
 * `Bell` = following and audible, `BellOff` = muted — the icon states the
 * current condition, and the label states the action a tap performs next.
 */
export function MuteBell({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const muted = useAppStore((s) => s.muted.includes(id));
  const toggleMute = useAppStore((s) => s.toggleMute);
  const label = muted ? t('notify.unmute', { name }) : t('notify.mute', { name });

  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label={label}
      onClick={() => void toggleMute(id)}
      className="btn btn-ghost btn-xs btn-circle"
    >
      {muted ? <BellOff size={14} /> : <Bell size={14} />}
    </button>
  );
}
