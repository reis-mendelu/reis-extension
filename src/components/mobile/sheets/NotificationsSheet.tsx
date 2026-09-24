import { useEffect, type ReactNode } from 'react';
import { Bell } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { useOpenNotification } from '../../../hooks/useOpenNotification';
import { NotificationItem } from '../../Notifications/NotificationItem';
import { DeadlineAlertItem } from '../../Notifications/DeadlineAlertItem';
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
/**
 * The app's own section label — `ProfileScreen`, `ExamGroup` and the search
 * results all use exactly this. Deadlines and society news are two different
 * kinds of thing, and stacking them unlabelled in one list was half of why the
 * feed read as a jumble.
 */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-base-content/60 first:pt-1">
      {children}
    </div>
  );
}

export function NotificationsSheet({ onClose }: NotificationsSheetProps) {
  const { t } = useTranslation();
  const { notifications, loading, markVisible, settingsLoading, readIds } = useNotificationFeed();
  const { alerts, markAllSeen } = useDeadlineAlerts();
  const hasContent = notifications.length > 0 || alerts.length > 0;
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const markNotificationsRead = useAppStore((s) => s.markNotificationsRead);

  /**
   * Opening this sheet IS reading the feed — so the sheet marks it read.
   *
   * The bell's badge counts `notifications` minus `readIds`, and the only code
   * that ever added to `readIds` was `useNotificationFeed().toggle()`, which
   * belongs to the DESKTOP dropdown. The phone's bell calls `pushSheet`, so the
   * student read every notification here and the dot stayed lit forever.
   *
   * Gated on `settingsLoading`, not just on mount: `notifications` is the feed
   * filtered by the spolky subscriptions, which are read out of IndexedDB, so
   * on a cold open the list is still empty for a tick or two. Marking then
   * marks nothing and the badge survives — the very bug, reintroduced through a
   * race. Following the list instead of the mount also covers the 5-minute
   * refetch landing while the sheet is still up.
   */
  useEffect(() => {
    if (settingsLoading) return;
    const unread = notifications.filter((n) => !readIds.has(n.id)).map((n) => n.id);
    if (unread.length) void markNotificationsRead(unread);
  }, [notifications, readIds, settingsLoading, markNotificationsRead]);

  /**
   * The other half of the same badge. The bell counts unseen deadline alerts
   * too now that the calendar's strip is gone and this sheet is the only place
   * a deadline appears — so a count that opening the sheet could not clear
   * would be the very bug above, moved one field across.
   *
   * `markAllSeen` is already idempotent against `seenDeadlineAlertIds`, and
   * unlike the feed these are derived synchronously from data the store
   * already holds, so there is no settings gate to wait on.
   */
  useEffect(() => {
    if (alerts.length) markAllSeen(alerts.map((a) => a.id));
  }, [alerts, markAllSeen]);

  // Novinky's open logic is shared with the extension's bell dropdown; only
  // where the map lives differs — here it is a tab.
  const { opensSomewhere, openNotification } = useOpenNotification({
    onClose,
    showMap: () => setMobileTab('map'),
  });

  return (
    <Sheet size="full" onClose={onClose}>
      <SheetHeader title={t('notifications.title')} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1">
        {alerts.length > 0 && (
          <>
            <SectionLabel>{t('notifications.sectionDeadlines')}</SectionLabel>
            <div className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <DeadlineAlertItem key={alert.id} alert={alert} />
              ))}
            </div>
          </>
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
        ) : notifications.length > 0 ? (
          <>
            {/* Labelled only when there is something above it to tell it apart
                from — a lone group under a header that already says "Novinky"
                would be labelling the sheet twice. */}
            {alerts.length > 0 && (
              <SectionLabel>{t('notifications.sectionSocieties')}</SectionLabel>
            )}
            <div className="flex flex-col gap-2">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onVisible={() => markVisible(n.id)}
                  onClick={() => void openNotification(n)}
                  clickable={opensSomewhere(n)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
