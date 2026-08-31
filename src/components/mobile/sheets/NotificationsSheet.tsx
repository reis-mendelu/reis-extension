import { Bell } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { NotificationItem } from '../../Notifications/NotificationItem';
import { DeadlineAlertItem } from '../../Notifications/DeadlineAlertItem';
import { trackNotificationClick } from '../../../services/spolky';
import { openExternal } from '../../../mobile/openExternal';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';

export interface NotificationsSheetProps {
  onClose: () => void;
}

/**
 * Full-size feed of deadline alerts + spolky notifications, reusing the
 * exact same `useNotificationFeed`/`useDeadlineAlerts` hooks and
 * `NotificationItem`/`DeadlineAlertItem` renderers as desktop's
 * `NotificationDropdown` — this is the phone's whole "novinky" surface, not
 * a second implementation of it.
 */
export function NotificationsSheet({ onClose }: NotificationsSheetProps) {
  const { t } = useTranslation();
  const { notifications, loading, markVisible } = useNotificationFeed();
  const { alerts } = useDeadlineAlerts();
  const hasContent = notifications.length > 0 || alerts.length > 0;
  const mapEvents = useAppStore((s) => s.mapEvents);
  const focusEventById = useAppStore((s) => s.focusEventById);
  const setMobileTab = useAppStore((s) => s.setMobileTab);

  /**
   * A notification IS a `spolky_events` row — `fetchNotifications` reads that
   * table and maps its optional `url` column to `link`. Gating the whole tap on
   * that link meant every society event without one, which is most of them, was
   * announced here and could not be opened: the tap did nothing at all.
   *
   * The row's id is the map event's id (one `spolky_events` id space, mapped by
   * `toMapEvent`), so the event the student tapped is one the map already knows
   * how to show — `focusEventById` opens the same EventDetailCard a pin does,
   * with the venue, the RSVP and the event's own URL on it.
   *
   * The link keeps priority where it exists: an author who set a URL chose a
   * destination, and the academic feed's rows are deadlines rather than places.
   * A notification with neither a link nor a matching event (a far-future one
   * the public map filters out) does nothing rather than switching to a map with
   * nothing selected — and is not counted as a click, which is reserved for taps
   * that actually went somewhere.
   */
  // The same question the tap asks, asked for the affordance: a row that opens
  // something has to look like it does.
  const opensSomewhere = (n: (typeof notifications)[number]) =>
    !!n.link || mapEvents.some((e) => e.id === n.id);

  const openNotification = (n: (typeof notifications)[number]) => {
    const track = () => {
      if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
    };
    if (n.link) {
      track();
      // openExternal, not window.open: on Capacitor that hands
      // the URL to the system browser, which has no IS session.
      void openExternal(n.link);
      onClose();
      return;
    }
    if (!opensSomewhere(n)) return;
    track();
    focusEventById(n.id, { fly: true });
    setMobileTab('map');
    onClose();
  };

  return (
    <Sheet size="full" onClose={onClose}>
      <SheetHeader title={t('notifications.title')} onClose={onClose} />
      <div className="flex-1 overflow-y-auto pb-6">
        {alerts.length > 0 && (
          <div className="divide-y divide-base-300">
            {alerts.map((alert) => (
              <DeadlineAlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        )}
        {loading && !notifications.length ? (
          <div className="p-6 text-center text-base text-base-content/60">
            {t('notifications.loading')}
          </div>
        ) : !hasContent ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-base-content/60">
            <Bell size={40} className="opacity-40" />
            <p>{t('notifications.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-base-300">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onVisible={() => markVisible(n.id)}
                onClick={() => openNotification(n)}
                clickable={opensSomewhere(n)}
              />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
